import { supabaseAdmin, isSupabaseConfigured } from '@/lib/services/supabase';
import { verifyWhatsAppSignature } from '@/lib/services/whatsapp';
import { parseWhatsAppWebhook } from '@/lib/services/whatsapp-webhook';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  const challenge = params.get('hub.challenge');
  if (!token || params.get('hub.mode') !== 'subscribe' || params.get('hub.verify_token') !== token || !challenge || !/^\d{1,100}$/.test(challenge)) {
    return new Response('Forbidden', { status: 403 });
  }
  return new Response(challenge, { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  const accountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!secret || !accountId || !phoneId || !isSupabaseConfigured) return Response.json({ error: 'Not configured' }, { status: 503 });
  if (Number(request.headers.get('content-length')) > 1_000_000) return new Response('Too large', { status: 413 });
  // Enforce the limit even when content-length is absent or misleading.
  const reader = request.body?.getReader();
  if (!reader) return new Response('Missing body', { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 1_000_000) { await reader.cancel(); return new Response('Too large', { status: 413 }); }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!verifyWhatsAppSignature(raw, request.headers.get('x-hub-signature-256'), secret)) return new Response('Invalid signature', { status: 401 });
  let payload;
  try { payload = JSON.parse(raw); } catch { return new Response('Invalid JSON', { status: 400 }); }
  const { deliveries, stops } = parseWhatsAppWebhook(payload, accountId, phoneId);
  try {
    // A replay cannot remove an opt-out; re-subscription needs explicit review.
    if (stops.length) {
      const { error } = await supabaseAdmin.from('whatsapp_opt_outs')
        .upsert(stops.map(phone => ({ phone })), { onConflict: 'phone', ignoreDuplicates: true });
      if (error) throw error;
    }
    if (deliveries.length) {
      const { error } = await supabaseAdmin.from('whatsapp_delivery_events')
        .upsert(deliveries, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw error;
    }
    return Response.json({ received: true });
  } catch {
    // Non-2xx requests redelivery; never acknowledge a failed durable write.
    return Response.json({ error: 'Unable to store event' }, { status: 503 });
  }
}
