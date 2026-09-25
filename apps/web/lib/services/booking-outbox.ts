import { supabaseAdmin } from '@/lib/services/supabase';
import { sendBookingConfirmation, sendAdminBookingNotification, sendGroupSessionConfirmation } from '@/lib/services/email';
import type { VerifiedPayment } from '@/lib/services/booking-documents';

type NotificationJob = {
  id: string;
  resource_booking_id?: string | null;
  group_booking_id?: string | null;
  recipient_role: 'customer' | 'admin';
  payment?: VerifiedPayment;
  attempts: number;
};

function blockSchedule(sessions: Array<{ start_at: string; end_at?: string | null }>) {
  const date = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' });
  const time = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Europe/London' });
  return sessions.map(session => {
    const start = new Date(session.start_at);
    const end = session.end_at ? new Date(session.end_at) : null;
    return `${date.format(start)}, ${time.format(start)}${end ? `–${time.format(end)}` : ''}`;
  }).join('; ');
}

async function processJobs(jobs: NotificationJob[]) {
  let sent = 0, deferred = 0;
  for (const job of jobs ?? []) {
    let success = false;
    try {
      if (job.resource_booking_id) {
        const { data: booking, error: readError } = await supabaseAdmin.from('bookings')
          .select('*, resource:resources!bookings_resource_id_fkey(name)').eq('id', job.resource_booking_id).single();
        if (readError || !booking || booking.payment_status !== 'paid') throw new Error('Confirmed booking unavailable');
        if (booking.block_booking_id) {
          const [{ data: block, error: blockError }, { data: sessions, error: sessionsError }] = await Promise.all([
            supabaseAdmin.from('block_bookings').select('booking_reference,customer_name,customer_email,amount,quote_id,payment_status').eq('id', booking.block_booking_id).single(),
            supabaseAdmin.from('bookings').select('start_at,end_at').eq('block_booking_id', booking.block_booking_id).order('start_at'),
          ]);
          if (blockError || sessionsError || !block || block.payment_status !== 'paid' || !sessions?.length) throw new Error('Confirmed block booking unavailable');
          const summary = {
            ...booking,
            ...block,
            service_type: 'lane_hire_block',
            resource_name: booking.resource?.name,
            block_session_count: sessions.length,
            block_schedule: blockSchedule(sessions),
          };
          success = job.recipient_role === 'admin'
            ? await sendAdminBookingNotification(summary, job.id)
            : await sendBookingConfirmation({ ...summary, payment: job.payment }, job.id);
        } else {
          success = job.recipient_role === 'admin'
            ? await sendAdminBookingNotification(booking, job.id)
            : await sendBookingConfirmation({ ...booking, resource_name: booking.resource?.name, payment: job.payment }, job.id);
        }
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

export async function dispatchBookingNotifications(limit = 10) {
  const { data: jobs, error } = await supabaseAdmin.rpc('claim_booking_notifications', { p_limit: limit });
  if (error) throw error;
  return processJobs((jobs ?? []) as NotificationJob[]);
}

/** Delivers only notifications belonging to the block that just completed. */
export async function dispatchBlockBookingNotifications(blockBookingId: string) {
  const { data: jobs, error } = await supabaseAdmin.rpc('claim_block_booking_notifications', {
    p_block_booking_id: blockBookingId,
    p_limit: 2,
  });
  if (error) throw error;
  return processJobs((jobs ?? []) as NotificationJob[]);
}
