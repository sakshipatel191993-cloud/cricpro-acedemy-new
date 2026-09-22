import { Resend, type CreateEmailOptions } from 'resend';
import { supabaseAdmin } from '@/lib/services/supabase';

// Persist the fully rendered request (including PDF bytes) before first send.
// A retry must not regenerate a different PDF under the same idempotency key.
export async function sendDurableEmail(id: string, rendered: CreateEmailOptions): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const request = {
    ...rendered,
    attachments: rendered.attachments?.map(attachment => ({ ...attachment,
      content: Buffer.isBuffer(attachment.content) ? attachment.content.toString('base64') : attachment.content,
    })),
  };
  const { error: writeError } = await supabaseAdmin.from('booking_notification_outbox')
    .update({ request, first_send_at: new Date().toISOString() }).eq('id', id).is('request', null);
  if (writeError) throw writeError;
  const { data: job, error } = await supabaseAdmin.from('booking_notification_outbox')
    .select('request, first_send_at').eq('id', id).single();
  if (error || !job?.request || !job.first_send_at) throw new Error('Email payload was not persisted');
  if (Date.now() - new Date(job.first_send_at).getTime() >= 23 * 60 * 60 * 1000) {
    throw new Error('Email requires manual delivery review');
  }
  const result = await new Resend(key).emails.send(job.request as CreateEmailOptions, { idempotencyKey: `booking-notice/${id}` });
  if (result.error) {
    const permanent = result.error.name !== 'rate_limit_exceeded' && !['application_error', 'internal_server_error'].includes(result.error.name);
    if (permanent) {
      const { error: saveError } = await supabaseAdmin.from('booking_notification_outbox').update({ state: 'attention' }).eq('id', id);
      if (saveError) throw saveError;
    }
    return false;
  }
  const { error: saveError } = await supabaseAdmin.from('booking_notification_outbox')
    .update({ provider_id: result.data?.id }).eq('id', id);
  if (saveError) throw saveError;
  return true;
}
