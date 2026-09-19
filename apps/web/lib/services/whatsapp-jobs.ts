import { supabaseAdmin } from './supabase';
import { normalizeWhatsAppPhone, sendWhatsAppTemplate, type WhatsAppConsent, type WhatsAppEvent } from './whatsapp';

type Source = Record<string, any>;
export function whatsappJobPayload(table: string, row: Source, phone: string) {
  const consent = row.whatsapp_consent as WhatsAppConsent | undefined;
  const currentPhone = table === 'bookings' ? row.customer_phone : table === 'group_session_bookings' ? row.parent_phone : row.phone;
  if (!consent || consent.phone !== phone || typeof currentPhone !== 'string' || normalizeWhatsAppPhone(currentPhone) !== phone) return null;
  if (table === 'inquiries') return { event: 'enquiry_received' as WhatsAppEvent, phone, consent, values: [row.name, String(row.type).replaceAll('_', ' ')] };
  if (!['bookings', 'group_session_bookings'].includes(table) || row.status !== 'confirmed' || row.payment_status !== 'paid') return null;
  if (table === 'group_session_bookings') {
    if (!row.session?.title || !row.session?.schedule) return null;
    return { event: 'booking_confirmed' as WhatsAppEvent, phone, consent, values: [row.parent_name, row.id, row.session.title, row.session.schedule] };
  }
  const date = new Date(row.start_at);
  if (!Number.isFinite(date.getTime())) return null;
  return { event: 'booking_confirmed' as WhatsAppEvent, phone, consent, values: [row.customer_name, row.booking_reference,
    String(row.service_type).replaceAll('_', ' '), date.toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' })] };
}

/** Bounded worker. Compare-and-swap claims prevent overlapping workers sending
 * the same job. An interrupted claim is ambiguous, NOT returned to the queue. */
export async function processWhatsAppJobs(db = supabaseAdmin, send = sendWhatsAppTemplate) {
  if (process.env.WHATSAPP_ENABLED !== 'true') return { disabled: true, processed: 0 };
  const now = new Date();
  const { error: staleError } = await db.from('whatsapp_jobs').update({ status: 'ambiguous', error: 'worker_interrupted' })
    .eq('status', 'processing').lt('claimed_at', new Date(now.getTime() - 120_000).toISOString());
  if (staleError) throw new Error('Unable to reconcile WhatsApp jobs');
  const { data: jobs, error } = await db.from('whatsapp_jobs').select('*').eq('status', 'pending')
    .lte('next_attempt_at', now.toISOString()).order('next_attempt_at').limit(3);
  if (error) throw new Error('Unable to load WhatsApp jobs');
  let processed = 0;
  for (const job of jobs || []) {
    const { data: claim, error: claimError } = await db.from('whatsapp_jobs')
      .update({ status: 'processing', claimed_at: now.toISOString(), attempts: job.attempts + 1 })
      .eq('id', job.id).eq('status', 'pending').select('id').maybeSingle();
    if (claimError) throw new Error('Unable to claim WhatsApp job');
    if (!claim) continue;
    let update: Record<string, unknown>;
    try {
      if (!['bookings', 'group_session_bookings', 'inquiries'].includes(job.source_table)) throw new Error('Invalid source');
      const { data: source, error: sourceError } = await db.from(job.source_table)
        .select(job.source_table === 'group_session_bookings' ? '*, session:group_sessions(title, schedule)' : '*')
        .eq('id', job.source_id).maybeSingle();
      const { data: stopped, error: stopError } = await db.from('whatsapp_opt_outs').select('phone').eq('phone', job.phone).maybeSingle();
      if (sourceError || stopError) throw new Error('Unable to check current consent');
      const payload = source ? whatsappJobPayload(job.source_table, source, job.phone) : null;
      // Do not send stale confirmations if the worker was disabled for a long time.
      if (stopped || !payload || Date.now() - Date.parse(job.created_at) > 24 * 60 * 60 * 1000) {
        update = { status: 'skipped', error: stopped ? 'opted_out' : !payload ? 'no_longer_eligible' : 'expired' };
      } else {
        const result = await send(payload);
        if (result.status === 'accepted') update = { status: 'accepted', message_id: result.messageId, error: null };
        else if (result.status === 'skipped') update = { status: 'skipped', error: result.reason };
        else if (result.retryable && job.attempts < 2) update = { status: 'pending', error: result.reason,
          next_attempt_at: new Date(Date.now() + 60_000 * 2 ** job.attempts).toISOString() };
        else update = { status: result.reason.startsWith('ambiguous') || /^provider_http_5/.test(result.reason) ? 'ambiguous' : 'failed', error: result.reason };
      }
    } catch {
      // Fail closed. A thrown transport error may already have sent a message.
      update = { status: 'ambiguous', error: 'worker_error' };
    }
    const { error: saveError } = await db.from('whatsapp_jobs').update(update).eq('id', job.id).eq('status', 'processing');
    if (saveError) throw new Error('Unable to save WhatsApp result');
    processed++;
  }
  return { disabled: false, processed };
}
