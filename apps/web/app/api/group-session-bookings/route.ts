import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { createCheckoutSession, getStripe, paymentsEnabled } from '@/lib/services/stripe';
import { reconcileGroupCheckouts } from '@/lib/services/session-checkout';
import { isSessionAgeAllowed, sessionAgeRange } from '@/lib/session-age';

export async function POST(request: NextRequest) {
  if (!paymentsEnabled) return NextResponse.json({ success: false, error: 'Online payments are currently unavailable. Please try again later.' }, { status: 503 });
  let bookingId: string | undefined;
  let stripeSessionId: string | undefined;
  try {
    const body = await request.json();
    const { session_id, player_name, player_age, parent_name, parent_email, parent_phone, emergency_contact, medical_notes, skill_level } = body;
    if (![session_id, player_name, parent_name, parent_email, parent_phone].every(value => typeof value === 'string' && value.trim())) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parent_email) || (player_age && (!Number.isInteger(Number(player_age)) || Number(player_age) < 1))) {
      return NextResponse.json({ success: false, error: 'Enter a valid email and player age' }, { status: 400 });
    }
    const { data: session, error: sessionError } = await supabaseAdmin.from('group_sessions')
      .select('*').eq('id', session_id).eq('active', true).single();
    if (sessionError || !session) return NextResponse.json({ success: false, error: 'Session not found or inactive' }, { status: 404 });
    if (!sessionAgeRange(session.age_group)) {
      return NextResponse.json({ success: false, error: 'This session has no valid age group. Please contact us before booking.' }, { status: 400 });
    }
    if (!isSessionAgeAllowed(player_age, session.age_group)) {
      return NextResponse.json({ success: false, error: `Player age must match this session's age group: ${session.age_group}` }, { status: 400 });
    }
    await reconcileGroupCheckouts(session_id);
    if (!Number.isFinite(Number(session.price)) || Number(session.price) < 0.30) {
      return NextResponse.json({ success: false, error: 'This session is not available for online payment. Please contact us.' }, { status: 400 });
    }
    const id = randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 1860;
    const { error: bookingError } = await supabaseAdmin.from('group_session_bookings').insert({
      id, session_id, player_name, player_age: player_age ? Number(player_age) : null,
      parent_name, parent_email, parent_phone, emergency_contact, medical_notes, skill_level,
      status: 'pending_payment', payment_status: 'pending', amount: session.price,
      expires_at: new Date(expiresAt * 1000).toISOString(),
    });
    if (bookingError) {
      if (bookingError.code === '23514') return NextResponse.json({ success: false, error: 'Session is full or inactive' }, { status: 409 });
      throw bookingError;
    }
    bookingId = id;
    const checkout = await createCheckoutSession({
      bookingId: id, bookingReference: id, bookingKind: 'group_session',
      serviceType: session.session_kind === 'masterclass' ? 'masterclass' : 'group_session',
      amount: String(session.price), customerEmail: parent_email, customerName: parent_name,
      description: `${session.title} – ${session.schedule}`, expiresAt,
    });
    stripeSessionId = checkout.sessionId;
    const { error: saveError } = await supabaseAdmin.from('group_session_bookings')
      .update({ stripe_session_id: stripeSessionId }).eq('id', id);
    if (saveError) throw saveError;
    return NextResponse.json({ success: true, paymentUrl: checkout.url });
  } catch (error) {
    // A failed checkout must not leave a permanent reservation. If Stripe created
    // one, expire it before releasing the place so it cannot subsequently be paid.
    if (bookingId) {
      try {
        if (stripeSessionId) await getStripe().checkout.sessions.expire(stripeSessionId);
        const { error: cancelError } = await supabaseAdmin.from('group_session_bookings')
          .update({ status: 'cancelled', payment_status: 'failed' }).eq('id', bookingId).eq('status', 'pending_payment');
        if (cancelError) throw cancelError;
      } catch (cleanupError) { console.error('Checkout cleanup failed:', cleanupError); }
    }
    console.error('Session checkout error:', error);
    return NextResponse.json({ success: false, error: 'Unable to start payment. Please try again.' }, { status: 500 });
  }
}
