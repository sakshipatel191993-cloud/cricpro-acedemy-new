import { supabaseAdmin } from '@/lib/services/supabase';
import { sendBookingCancellationNotice } from '@/lib/services/email';

type CancellationJob = {
  id: string;
  booking_kind: 'resource' | 'group';
  booking_id: string;
  event_type: 'cancelled' | 'refund_succeeded' | 'refund_failed';
  snapshot: { amount: string; payment_status: string; refund_status: string | null };
  attempts: number;
};

function resourceSchedule(startAt: string, endAt: string, quoteId: string | null) {
  const zone = quoteId ? 'Europe/London' : 'UTC';
  const date = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: zone });
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: zone });
  return `${date.format(new Date(startAt))}, ${time.format(new Date(startAt))}–${time.format(new Date(endAt))}`;
}

export async function dispatchCancellationNotifications(limit = 10) {
  const { data, error } = await supabaseAdmin.rpc('claim_booking_cancellation_notices', { p_limit: limit });
  if (error) throw error;
  let sent = 0, deferred = 0;
  for (const job of (data ?? []) as CancellationJob[]) {
    let success = false;
    try {
      if (job.booking_kind === 'resource') {
        const { data: booking, error: readError } = await supabaseAdmin.from('bookings')
          .select('booking_reference, customer_name, customer_email, service_type, start_at, end_at, quote_id, resource:resources!bookings_resource_id_fkey(name)')
          .eq('id', job.booking_id).single();
        if (readError || !booking) throw new Error('Cancelled booking unavailable');
        const resource = Array.isArray(booking.resource) ? booking.resource[0] : booking.resource;
        success = await sendBookingCancellationNotice({
          recipient: booking.customer_email, name: booking.customer_name,
          reference: booking.booking_reference, service: resource?.name || booking.service_type.replaceAll('_', ' '),
          schedule: resourceSchedule(booking.start_at, booking.end_at, booking.quote_id),
          amount: job.snapshot.amount, paymentStatus: job.snapshot.payment_status,
          refundStatus: job.snapshot.refund_status, eventType: job.event_type,
        }, job.id);
      } else {
        const { data: booking, error: readError } = await supabaseAdmin.from('group_session_bookings')
          .select('booking_reference, parent_name, parent_email, session:group_sessions(title, schedule, session_kind)')
          .eq('id', job.booking_id).single();
        if (readError || !booking) throw new Error('Cancelled session booking unavailable');
        const session = Array.isArray(booking.session) ? booking.session[0] : booking.session;
        success = await sendBookingCancellationNotice({
          recipient: booking.parent_email, name: booking.parent_name,
          reference: booking.booking_reference,
          service: session?.session_kind === 'masterclass' ? `Masterclass: ${session.title}` : `Group session: ${session?.title || 'Coaching'}`,
          schedule: session?.schedule, amount: job.snapshot.amount,
          paymentStatus: job.snapshot.payment_status, refundStatus: job.snapshot.refund_status,
          eventType: job.event_type,
        }, job.id);
      }
    } catch { /* Keep the durable job for retry; never log customer details. */ }
    const delay = Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7));
    const { error: saveError } = await supabaseAdmin.from('booking_cancellation_outbox').update(success
      ? { state: 'sent', sent_at: new Date().toISOString(), lease_until: null }
      : { state: job.attempts >= 10 ? 'attention' : 'pending', lease_until: null,
          next_attempt_at: new Date(Date.now() + delay * 1000).toISOString() })
      .eq('id', job.id).eq('state', 'sending').eq('attempts', job.attempts);
    if (saveError) throw saveError;
    if (success) sent++; else deferred++;
  }
  return { inspected: data?.length ?? 0, sent, deferred };
}
