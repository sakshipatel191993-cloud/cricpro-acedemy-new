import { supabaseAdmin } from '@/lib/services/supabase';
import { sendBookingConfirmation, sendAdminBookingNotification, sendGroupSessionConfirmation } from '@/lib/services/email';

export async function dispatchBookingNotifications(limit = 10) {
  const { data: jobs, error } = await supabaseAdmin.rpc('claim_booking_notifications', { p_limit: limit });
  if (error) throw error;
  let sent = 0, deferred = 0;
  for (const job of jobs ?? []) {
    let success = false;
    try {
      if (job.resource_booking_id) {
        const { data: booking, error: readError } = await supabaseAdmin.from('bookings')
          .select('*, resource:resources!bookings_resource_id_fkey(name)').eq('id', job.resource_booking_id).single();
        if (readError || !booking || booking.payment_status !== 'paid') throw new Error('Confirmed booking unavailable');
        success = job.recipient_role === 'admin'
          ? await sendAdminBookingNotification(booking, job.id)
          : await sendBookingConfirmation({ ...booking, resource_name: booking.resource?.name, payment: job.payment }, job.id);
      } else {
        const { data: booking, error: readError } = await supabaseAdmin.from('group_session_bookings')
          .select('*, session:group_sessions(title,schedule,session_kind)').eq('id', job.group_booking_id).single();
        if (readError || !booking || booking.payment_status !== 'paid') throw new Error('Confirmed booking unavailable');
        success = await sendGroupSessionConfirmation(booking, {
          ...booking.session, price: Number(booking.amount).toFixed(2),
        }, job.payment, job.id);
      }
    } catch { /* Retain durable work; never log customer payloads or credentials. */ }
    const delay = Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7));
    const { error: saveError } = await supabaseAdmin.from('booking_notification_outbox').update(success
      ? { state: 'sent', sent_at: new Date().toISOString(), lease_until: null }
      : { state: job.attempts >= 10 ? 'attention' : 'pending', lease_until: null,
          next_attempt_at: new Date(Date.now() + delay * 1000).toISOString() })
      .eq('id', job.id).eq('state', 'sending').eq('attempts', job.attempts);
    if (saveError) throw saveError;
    if (success) sent++; else deferred++;
  }
  return { inspected: jobs?.length ?? 0, sent, deferred };
}
