import { supabaseAdmin } from '@/lib/services/supabase';
import { getStripe } from '@/lib/services/stripe';
import { confirmGroupBooking } from '@/lib/services/confirm-group-booking';

export async function expireGroupCheckout(bookingId: string, stripeSessionId: string) {
  const { error } = await supabaseAdmin.from('group_session_bookings')
    .update({ status: 'expired', payment_status: 'failed' })
    .eq('id', bookingId).eq('stripe_session_id', stripeSessionId).eq('status', 'pending_payment');
  if (error) throw error;
}

// Recover holds even if an expiry webhook was missed. Never release a paid place.
export async function reconcileGroupCheckouts(sessionId: string) {
  const { data, error } = await supabaseAdmin.from('group_session_bookings')
    .select('id, stripe_session_id').eq('session_id', sessionId).eq('status', 'pending_payment')
    .lt('expires_at', new Date().toISOString()).limit(50);
  if (error) throw error;
  for (const booking of data ?? []) {
    if (!booking.stripe_session_id) {
      // Missing ID can mean a lost Stripe response or failed persistence, not
      // proof that no payment exists. Recovery must consult the durable attempt.
      continue;
    }
    const checkout = await getStripe().checkout.sessions.retrieve(booking.stripe_session_id);
    if (checkout.payment_status === 'paid') await confirmGroupBooking(checkout);
    else if (checkout.status === 'expired') await expireGroupCheckout(booking.id, checkout.id);
  }
}
