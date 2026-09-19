import { NextRequest, NextResponse } from 'next/server';
import { Resend, type WebhookEventPayload } from 'resend';

import { isSupabaseConfigured, supabaseAdmin } from '@/lib/services/supabase';

export const runtime = 'nodejs';

type WebhookStatus = 'processing' | 'processed' | 'ignored' | 'failed';

function emailAddress(value: string): string {
  const angleBracketAddress = value.match(/<([^>]+)>/);
  return (angleBracketAddress?.[1] ?? value).trim().toLowerCase();
}

function allowedSenders(): Set<string> {
  return new Set(
    (process.env.RESEND_ALLOWED_SENDERS ?? '')
      .split(',')
      .map(emailAddress)
      .filter(Boolean)
  );
}

function eventMetadata(event: WebhookEventPayload) {
  if (!('email_id' in event.data)) return {};

  return {
    resend_email_id: event.data.email_id,
    from: event.data.from,
    to: event.data.to,
    subject: event.data.subject,
  };
}

async function claimEvent(
  svixId: string,
  event: WebhookEventPayload
): Promise<boolean> {
  const { error } = await supabaseAdmin.from('resend_webhook_events').insert({
    id: svixId,
    event_type: event.type,
    resend_email_id:
      'email_id' in event.data ? event.data.email_id : null,
    status: 'processing' satisfies WebhookStatus,
    metadata: eventMetadata(event),
  });

  if (!error) return true;
  if (error.code !== '23505') throw error;

  const { data, error: lookupError } = await supabaseAdmin
    .from('resend_webhook_events')
    .select('status')
    .eq('id', svixId)
    .single();

  if (lookupError) throw lookupError;
  if (data.status !== 'failed') return false;

  const { error: retryError } = await supabaseAdmin
    .from('resend_webhook_events')
    .update({ status: 'processing', error: null, processed_at: null })
    .eq('id', svixId);

  if (retryError) throw retryError;
  return true;
}

async function finishEvent(
  svixId: string,
  status: Exclude<WebhookStatus, 'processing'>,
  error?: string
) {
  const { error: updateError } = await supabaseAdmin
    .from('resend_webhook_events')
    .update({
      status,
      error: error ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', svixId);

  if (updateError) throw updateError;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!apiKey || !webhookSecret || !isSupabaseConfigured) {
    console.error('[RESEND WEBHOOK] Server configuration is incomplete');
    return NextResponse.json(
      { error: 'Webhook is not configured' },
      { status: 503 }
    );
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: 'Missing webhook signature headers' },
      { status: 400 }
    );
  }

  const resend = new Resend(apiKey);
  const payload = await request.text();

  let event: WebhookEventPayload;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret,
    });
  } catch {
    console.warn('[RESEND WEBHOOK] Signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    const shouldProcess = await claimEvent(svixId, event);
    if (!shouldProcess) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (event.type === 'email.received') {
      const adminEmail = process.env.ADMIN_EMAIL;
      const fromEmail = process.env.EMAIL_FROM;

      if (!adminEmail || !fromEmail) {
        throw new Error('ADMIN_EMAIL and EMAIL_FROM are required');
      }

      const adminAddress = emailAddress(adminEmail);
      const recipients = event.data.to.map(emailAddress);

      // Prevent a forwarding loop if receiving is accidentally enabled on the
      // same mailbox used as the forwarding destination.
      if (recipients.includes(adminAddress)) {
        await finishEvent(svixId, 'ignored');
        return NextResponse.json({ received: true, ignored: 'forwarding_loop' });
      }

      // Optional strict allowlist. When unset, messages are only forwarded to
      // a human for review and never trigger autonomous actions.
      const senders = allowedSenders();
      const sender = emailAddress(event.data.from);
      if (senders.size > 0 && !senders.has(sender)) {
        console.warn('[RESEND WEBHOOK] Rejected non-allowlisted inbound sender');
        await finishEvent(svixId, 'ignored');
        return NextResponse.json({ received: true, ignored: 'sender_not_allowed' });
      }

      const { error: forwardError } = await resend.emails.receiving.forward({
        emailId: event.data.email_id,
        to: adminEmail,
        from: fromEmail,
        passthrough: true,
      });

      if (forwardError) throw new Error(forwardError.message);
    }

    if (
      event.type === 'email.bounced' ||
      event.type === 'email.failed' ||
      event.type === 'email.suppressed' ||
      event.type === 'email.complained' ||
      event.type === 'email.delivery_delayed'
    ) {
      console.warn(`[RESEND WEBHOOK] ${event.type}: ${event.data.email_id}`);
    }

    await finishEvent(svixId, 'processed');
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[RESEND WEBHOOK] Processing failed:', message);

    try {
      await finishEvent(svixId, 'failed', message.slice(0, 1_000));
    } catch (statusError) {
      console.error('[RESEND WEBHOOK] Failed to record error status:', statusError);
    }

    // Returning 500 asks Resend to retry with exponential backoff.
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
