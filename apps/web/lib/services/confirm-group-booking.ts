import type Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/services/supabase';
import { verifiedPayment } from '@/lib/services/booking-documents';

// Accept only sessions retrieved from Stripe or received through its signed webhook.
export async function confirmGroupBooking(session: Stripe.Checkout.Session) {
  if (session.mode !== 'payment' || session.payment_status !== 'paid' || session.metadata?.booking_kind !== 'group_session') {
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
  if (booking.status === 'confirmed' && booking.payment_status === 'paid') return booking;
  if (booking.status !== 'pending_payment') throw new Error('Booking is no longer pending payment');

  const { error: updateError } = await supabaseAdmin.rpc('confirm_booking_with_outbox', {
    p_kind: 'group', p_booking_id: booking.id, p_session_id: session.id, p_payment: verifiedPayment(session),
  });
  if (updateError) throw updateError;
  return { ...booking, status: 'confirmed', payment_status: 'paid' };
}
