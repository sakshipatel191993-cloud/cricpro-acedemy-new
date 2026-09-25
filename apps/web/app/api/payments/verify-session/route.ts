import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { getStripe } from '@/lib/services/stripe';
import { confirmGroupBooking } from '@/lib/services/confirm-group-booking';
import { confirmBooking } from '@/lib/services/confirm-booking';
import { confirmBlockBooking } from '@/lib/services/block-bookings';
import { dispatchBlockBookingNotifications, dispatchBookingNotifications } from '@/lib/services/booking-outbox';
import { accessibleScope, guestAccessEnabled, guestSameOrigin } from '@/lib/security/guest-access';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readJsonBody } from '@/lib/security/request-body';

export const maxDuration = 60;

/**
 * Verify-on-success fallback. Called by the booking-success page when the user
 * is redirected back from Stripe, so the booking is confirmed and emailed even
 * if the `checkout.session.completed` webhook was delayed or missed.
 */
export async function POST(request: NextRequest) {
  if (!guestSameOrigin(request)) return NextResponse.json({ success:false,error:'Forbidden' },{ status:403 });
  const limited = await enforceRateLimit(request,{ policy:'privateRead' });
  if (limited) return limited;
  try {
    const { sessionId } = await readJsonBody(request,2048);

    if (typeof sessionId !== 'string' || !/^cs_[A-Za-z0-9_]{8,240}$/.test(sessionId)) {
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

    if (session.metadata?.booking_kind === 'block') {
      const id = session.metadata.booking_id;
      if (!id) throw new Error('Block booking missing');
      await confirmBlockBooking(id, session.id);
      await dispatchBlockBookingNotifications(id).catch(() => console.error('Block booking notification dispatch deferred'));
      const { data: children, error } = await supabaseAdmin.from('bookings').select('id,booking_date,start_at,end_at').eq('block_booking_id', id).order('start_at');
      if (error || !children?.length) throw new Error('Block sessions unavailable');
      if (!guestAccessEnabled() || !await accessibleScope(request, 'resource', children[0]!.id)) return NextResponse.json({ success: true, booking: null }, { headers: { 'Cache-Control': 'private, no-store' } });
      const { data: block, error: blockError } = await supabaseAdmin.from('block_bookings').select('booking_reference,amount').eq('id', id).single();
      if (blockError || !block) throw new Error('Block unavailable');
      return NextResponse.json({ success: true, booking: { ...block, service_type: 'lane_hire', resource_name: `Lane hire block (${children.length} sessions)`, schedule: children.map(child => String(child.booking_date).slice(0, 10)).join(', ') } }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    if (session.metadata?.booking_kind === 'group_session') {
      const booking = await confirmGroupBooking(session);
      await dispatchBookingNotifications(5).catch(() => console.error('Booking notification dispatch deferred'));
      if (!guestAccessEnabled() || !await accessibleScope(request,'group',booking.id)) {
        return NextResponse.json({ success:true, booking:null },{ headers:{ 'Cache-Control':'private, no-store' } });
      }
      return NextResponse.json({ success: true, booking: {
        booking_reference: booking.id,
        service_type: booking.session.session_kind === 'masterclass' ? 'masterclass' : 'group_session',
        resource_name: booking.session.title,
        schedule: booking.session.schedule,
        coach_name: booking.session.coach_name,
        amount: booking.amount,
      } }, { headers: { 'Cache-Control': 'private, no-store' } });
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
    await dispatchBookingNotifications(5).catch(() => console.error('Booking notification dispatch deferred'));

    if (!guestAccessEnabled() || !await accessibleScope(request,'resource',bookingId)) {
      return NextResponse.json({ success:true, booking:null },{ headers:{ 'Cache-Control':'private, no-store' } });
    }

    // Fetch fresh booking details (with the lane/resource name) to show on the
    // confirmation page, regardless of whether this call or the webhook
    // performed the confirmation.
    const { data: bookingRow, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('booking_reference,service_type,booking_date,start_at,end_at,amount,resource:resources!bookings_resource_id_fkey(name)')
      .eq('id', bookingId)
      .single();
    if (bookingError) throw bookingError;

    return NextResponse.json({
      success: true,
      booking: bookingRow
        ? { ...bookingRow, resource_name: (Array.isArray(bookingRow.resource) ? bookingRow.resource[0]?.name : (bookingRow.resource as { name?: string } | null)?.name) ?? null }
        : null,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: any) {
    console.error('Payment verification unavailable');
    return NextResponse.json(
      { success: false, error: 'Failed to verify session. Please retry or contact support.' },
      { status: 500 }
    );
  }
}
