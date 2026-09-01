import { supabaseAdmin } from '@/lib/services/supabase';
import {
  sendBookingConfirmation,
  sendAdminBookingNotification,
} from '@/lib/services/email';
import type { DbBooking } from '@/lib/db/schema';

/**
 * Idempotently confirm a pending booking and send its confirmation emails.
 *
 * Both the Stripe webhook and the verify-on-success endpoint call this, so it
 * must be safe to call more than once: the update only matches rows that are
 * still `pending_payment`, and emails are only sent when this call performed
 * the transition. Returns the confirmed booking row, or `null` if the booking
 * had already been confirmed by a previous call.
 */
export async function confirmBooking(
  bookingId: string,
  stripeSessionId: string
): Promise<DbBooking | null> {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'confirmed',
      payment_status: 'paid',
      stripe_session_id: stripeSessionId,
    })
    .eq('id', bookingId)
    .eq('status', 'pending_payment')
    .select();

  if (error) throw error;

  const booking = data && data.length > 0 ? (data[0] as DbBooking) : null;

  if (booking) {
    // Resolve the lane/resource name so the confirmation email can show it.
    const { data: resource } = await supabaseAdmin
      .from('resources')
      .select('name')
      .eq('id', booking.resource_id)
      .single();

    // Await so the sends complete before the serverless function is frozen.
    await Promise.allSettled([
      sendBookingConfirmation({
        ...booking,
        resource_name: resource?.name ?? undefined,
      }),
      sendAdminBookingNotification(booking),
    ]);
  }

  return booking;
}
