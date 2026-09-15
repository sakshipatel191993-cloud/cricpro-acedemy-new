import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { getStripe } from '@/lib/services/stripe';
import { confirmGroupBooking } from '@/lib/services/confirm-group-booking';
import { confirmBooking } from '@/lib/services/confirm-booking';

/**
 * Verify-on-success fallback. Called by the booking-success page when the user
 * is redirected back from Stripe, so the booking is confirmed and emailed even
 * if the `checkout.session.completed` webhook was delayed or missed.
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'session_id is required' },
        { status: 400 }
      );
    }

    const session = await getStripe().checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { success: false, error: 'Payment has not been completed' },
        { status: 402 }
      );
    }

    if (session.metadata?.booking_kind === 'group_session') {
      const booking = await confirmGroupBooking(session);
      return NextResponse.json({ success: true, booking: {
        booking_reference: booking.id,
        service_type: booking.session.session_kind === 'masterclass' ? 'masterclass' : 'group_session',
        resource_name: booking.session.title,
        schedule: booking.session.schedule,
        coach_name: booking.session.coach_name,
        amount: booking.amount,
      } });
    }

    let bookingId = session.metadata?.booking_id;

    // Fallback: look the booking up by its stored Stripe session id.
    if (!bookingId) {
      const { data } = await supabaseAdmin
        .from('bookings')
        .select('id')
        .eq('stripe_session_id', sessionId)
        .single();
      bookingId = data?.id;
    }

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    await confirmBooking(bookingId, session.id);

    // Fetch fresh booking details (with the lane/resource name) to show on the
    // confirmation page, regardless of whether this call or the webhook
    // performed the confirmation.
    const { data: bookingRow } = await supabaseAdmin
      .from('bookings')
      .select('*, resources(name)')
      .eq('id', bookingId)
      .single();

    return NextResponse.json({
      success: true,
      booking: bookingRow
        ? { ...bookingRow, resource_name: bookingRow.resources?.name ?? null }
        : null,
    });
  } catch (error: any) {
    console.error('Verify session error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to verify session' },
      { status: 500 }
    );
  }
}
