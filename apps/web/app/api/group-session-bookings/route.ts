import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { paymentsEnabled } from '@/lib/services/stripe';
import { startPersistedCheckout } from '@/lib/services/checkout-attempts';
import { provisionBookingAccess } from '@/lib/security/guest-access';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { readJsonBody, RequestBodyError } from '@/lib/security/request-body';
import { reconcileGroupCheckouts } from '@/lib/services/session-checkout';
import { isSessionAgeAllowed, sessionAgeRange } from '@/lib/session-age';
import { londonInstant, moneyPence, QuoteError } from '@/lib/booking-quote';
import { isSameOriginRequest } from '@/lib/security/admin-auth';
import { couponsEnabled, couponRequest } from '@/lib/services/coupons';
import { groupCheckoutCookie, groupCheckoutCookieOptions, newGroupCheckoutKey, readGroupCheckoutKey, groupRequestIdentity } from '@/lib/security/group-checkout-key';

export async function POST(request: NextRequest) {
  if (!paymentsEnabled) return NextResponse.json({ success: false, error: 'Online payments are currently unavailable. Please try again later.' }, { status: 503 });
  const limited = await enforceRateLimit(request, { policy: 'booking' });
  if (limited) return limited;
  if (!isSameOriginRequest(request)) return NextResponse.json({ success: false, error: 'Invalid request origin' }, { status: 403 });
  const browserKey = readGroupCheckoutKey(request);
  if (!browserKey) {
    const response = NextResponse.json({ success: false, retryWithCookie: true }, { status: 428 });
    response.cookies.set(groupCheckoutCookie, newGroupCheckoutKey(), groupCheckoutCookieOptions);
    return response;
  }
  try {
    const body = await readJsonBody(request);
    const { session_id, player_name, player_age, parent_name, parent_email, parent_phone, emergency_contact, medical_notes, skill_level } = body;
    if (typeof session_id !== 'string' || typeof player_name !== 'string' ||
        typeof parent_name !== 'string' || typeof parent_email !== 'string' || typeof parent_phone !== 'string' ||
        ![session_id, player_name, parent_name, parent_email, parent_phone].every(value => value.trim())) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parent_email) || (player_age && (!Number.isInteger(Number(player_age)) || Number(player_age) < 1))) {
      return NextResponse.json({ success: false, error: 'Enter a valid email and player age' }, { status: 400 });
    }
    const { data: session, error: sessionError } = await supabaseAdmin.from('group_sessions')
      .select('*').eq('id', session_id).eq('active', true).single();
    if (sessionError || !session) return NextResponse.json({ success: false, error: 'Session not found or inactive' }, { status: 404 });
    if (![session.session_date, session.start_time, session.end_time].every(value => typeof value === 'string' && value)) {
      return NextResponse.json({ success: false, error: 'This session needs a dated schedule before it can be booked.' }, { status: 409 });
    }
    if ([emergency_contact, medical_notes, skill_level].some(value => value != null && typeof value !== 'string')) {
      return NextResponse.json({ success: false, error: 'Invalid booking details' }, { status: 400 });
    }
    const fields = { session_id, player_name, player_age: Number(player_age), parent_name, parent_email, parent_phone,
      ...(body.couponCode ? { couponCode: body.couponCode, couponVersion: body.couponVersion } : {}),
      emergency_contact: emergency_contact ?? null, medical_notes: medical_notes ?? null, skill_level: skill_level ?? null };
    let identity;
    try { identity = groupRequestIdentity(browserKey, body.requestId, fields); }
    catch { return NextResponse.json({ success: false, error: 'A valid booking request ID is required' }, { status: 400 }); }
    const { data: existing, error: existingError } = await supabaseAdmin.from('group_session_bookings').select('*').eq('id', identity.id).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return await checkoutResponse(request, existing, identity.fingerprint);
    const start = Date.parse(londonInstant(session.session_date, session.start_time));
    const end = Date.parse(londonInstant(session.session_date, session.end_time));
    if (start <= Date.now() || end <= start) return NextResponse.json({ success: false, error: 'This session is no longer available to book.' }, { status: 409 });
    if (!sessionAgeRange(session.age_group)) {
      return NextResponse.json({ success: false, error: 'This session has no valid age group. Please contact us before booking.' }, { status: 400 });
    }
    if (!isSessionAgeAllowed(player_age, session.age_group)) {
      return NextResponse.json({ success: false, error: `Player age must match this session's age group: ${session.age_group}` }, { status: 400 });
    }
    await reconcileGroupCheckouts(session_id);
    const amountPence = moneyPence(session.price);
    if (body.couponCode && body.couponSubtotal !== amountPence) return NextResponse.json({ success: false, error: 'The session price changed. Reapply the coupon before paying.' }, { status: 409 });
    if (amountPence < 30) {
      return NextResponse.json({ success: false, error: 'This session is not available for online payment. Please contact us.' }, { status: 400 });
    }
    const id = identity.id;
    const expiresAt = Math.floor(Date.now() / 1000) + 1860;
    const reservation = {
      id, session_id, player_name, player_age: player_age ? Number(player_age) : null,
      parent_name, parent_email, parent_phone, emergency_contact, medical_notes, skill_level,
      status: 'pending_payment', payment_status: 'pending', amount: (amountPence / 100).toFixed(2),
      expires_at: new Date(expiresAt * 1000).toISOString(),
      request_hash: identity.fingerprint,
      checkout_description: `${session.title} – ${session.schedule}`,
      checkout_service_type: session.session_kind === 'masterclass' ? 'masterclass' : 'group_session',
    };
    const promotion = await couponRequest(request, body, parent_email);
    const { data: discounted, error: bookingError } = couponsEnabled()
      ? await supabaseAdmin.rpc('reserve_group_with_coupon', { p_booking: reservation, ...promotion })
      : await supabaseAdmin.from('group_session_bookings').insert(reservation);
    if (bookingError) {
      if (bookingError.code === '23505' || bookingError.code === '23514') {
        // The capacity trigger can reject a racing replay before PostgreSQL
        // checks the primary key. Resolve our own browser-bound row first.
        const { data: raced, error: retryError } = await supabaseAdmin.from('group_session_bookings').select('*').eq('id', id).maybeSingle();
        if (retryError) throw retryError;
        if (raced) return await checkoutResponse(request, raced, identity.fingerprint);
        if (bookingError.code === '23505') throw new Error('Reservation unavailable');
      }
      if (bookingError.code === '23514') return NextResponse.json({ success: false, error: 'Session is full or inactive' }, { status: 409 });
      if (couponsEnabled()) return NextResponse.json({ success: false, error: 'This coupon or session is no longer available. Reapply or remove the coupon and try again.' }, { status: 409 });
      throw bookingError;
    }
    return await checkoutResponse(request, couponsEnabled() ? discounted : reservation, identity.fingerprint);
  } catch (error) {
    // A timeout can mean Stripe accepted payment creation. Keep the hold until
    // durable reconciliation proves the provider session is unpaid and terminal.
    if (error instanceof RequestBodyError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    if (error instanceof QuoteError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    console.error('Session checkout requires recovery');
    return NextResponse.json({ success: false, error: 'Unable to start payment. Please contact us before booking again.' }, { status: 503 });
  }
}

async function checkoutResponse(request: Request, booking: any, fingerprint: string) {
  if (booking.request_hash !== fingerprint) return NextResponse.json({ success: false, error: 'This request was already used with different booking details. Start a new booking.' }, { status: 409 });
  if (booking.status !== 'pending_payment') return NextResponse.json({ success: false, error: 'This booking has already been processed. Please view your booking or contact us.' }, { status: 409 });
  const access = await provisionBookingAccess(request, 'group', booking.id);
  const checkout = await startPersistedCheckout({
    bookingId: booking.id, bookingReference: booking.id, bookingKind: 'group_session', serviceType: booking.checkout_service_type,
    amount: String(booking.amount), customerEmail: booking.parent_email, customerName: booking.parent_name,
    description: booking.checkout_description, expiresAt: Math.floor(new Date(booking.expires_at).getTime() / 1000),
    ...(booking.coupon_snapshot?.code ? { coupon: booking.coupon_snapshot } : {}),
  });
  if (!checkout.url) return NextResponse.json({ success: false, error: 'Payment is no longer available for this checkout.' }, { status: 409 });
  const response = NextResponse.json({ success: true, paymentUrl: checkout.url }, { headers: { 'Cache-Control': 'no-store' } });
  if (access) response.cookies.set(access.cookie.name, access.cookie.value, access.cookie.options);
  return response;
}
