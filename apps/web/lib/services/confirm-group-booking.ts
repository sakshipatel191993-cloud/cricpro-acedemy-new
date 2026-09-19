import type Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/services/supabase';
import { sendGroupSessionConfirmation } from '@/lib/services/email';
import { verifiedPayment } from '@/lib/services/booking-documents';
import { dispatchWhatsApp } from '@/lib/services/whatsapp-dispatch';

// Accept only sessions retrieved from Stripe or received through its signed webhook.
export async function confirmGroupBooking(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid' || session.metadata?.booking_kind !== 'group_session') {
    throw new Error('Payment has not been completed');
  }
  const { data: booking, error } = await supabaseAdmin.from('group_session_bookings')
    .select('*, session:group_sessions(title, schedule, coach_name, session_kind)')
    .eq('id', session.metadata.booking_id).single();
  if (error || !booking) throw new Error('Booking not found');
  if (booking.stripe_session_id !== session.id || session.currency !== 'gbp' ||
      session.amount_total !== Math.round(Number(booking.amount) * 100)) {
    throw new Error('Payment does not match this booking');
  }
  if (booking.status === 'confirmed' && booking.payment_status === 'paid') {
    dispatchWhatsApp('group_session_bookings', booking.id);
    return booking;
  }
  if (booking.status !== 'pending_payment') throw new Error('Booking is no longer pending payment');

  const { data: updated, error: updateError } = await supabaseAdmin.from('group_session_bookings')
    .update({ status: 'confirmed', payment_status: 'paid' })
    .eq('id', booking.id).eq('stripe_session_id', session.id).eq('status', 'pending_payment').select();
  if (updateError) throw updateError;
  dispatchWhatsApp('group_session_bookings', booking.id);
  if (updated?.length) {
    await sendGroupSessionConfirmation(booking, {
      title: booking.session.title, price: Number(booking.amount).toFixed(2),
      session_kind: booking.session.session_kind,
      schedule: booking.session.schedule,
    }, verifiedPayment(session)).catch(error => console.error('Session confirmation email failed:', error));
  }
  return { ...booking, status: 'confirmed', payment_status: 'paid' };
}
