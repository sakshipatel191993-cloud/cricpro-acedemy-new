import { supabaseAdmin } from '@/lib/services/supabase';
import type { DbBooking } from '@/lib/db/schema';
import { getStripe } from '@/lib/services/stripe';
import { verifiedPayment } from '@/lib/services/booking-documents';
import { dispatchWhatsApp } from '@/lib/services/whatsapp-dispatch';

/**
 * Idempotently confirm a pending booking and durably queue its emails.
 *
 * Both the Stripe webhook and the verify-on-success endpoint call this, so it
 * must be safe to call more than once: the update only matches rows that are
 * still `pending_payment`, and email jobs are inserted in the same transaction.
 * Returns the confirmed booking row, or `null` if the booking
 * had already been confirmed by a previous call.
 */
export async function confirmBooking(
  bookingId: string,
  stripeSessionId: string
): Promise<DbBooking | null> {
  const session = await getStripe().checkout.sessions.retrieve(stripeSessionId);
  const payment = verifiedPayment(session);
  const { data: pending, error: lookupError } = await supabaseAdmin.from('bookings').select('*').eq('id', bookingId).single();
  if (lookupError || !pending || session.mode !== 'payment' || pending.stripe_session_id !== session.id ||
      session.metadata?.booking_id !== bookingId ||
      payment.amount !== Math.round(Number(pending.amount) * 100)) {
    throw new Error('Payment does not match this booking');
  }
  const { data, error } = await supabaseAdmin.rpc('confirm_booking_with_outbox', {
    p_kind: 'resource', p_booking_id: bookingId, p_session_id: stripeSessionId, p_payment: payment,
  });

  if (error) throw error;

  dispatchWhatsApp('bookings', bookingId);
  return data ? { ...pending, status: 'confirmed', payment_status: 'paid' } as DbBooking : null;
}
