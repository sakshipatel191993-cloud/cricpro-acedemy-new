import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/services/stripe';
import { supabaseAdmin } from '@/lib/services/supabase';
import { dispatchCancellationNotifications } from '@/lib/services/cancellation-outbox';

type Kind = 'resource' | 'group';
const tableFor = (kind: Kind) => kind === 'resource' ? 'bookings' : 'group_session_bookings';

export async function POST(request: NextRequest) {
  let body: { kind?: Kind; id?: string; refund?: boolean };
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 }); }
  if (!['resource', 'group'].includes(body.kind || '') || typeof body.id !== 'string' || !body.id || typeof body.refund !== 'boolean') {
    return NextResponse.json({ success: false, error: 'Booking, kind and refund choice are required' }, { status: 400 });
  }
  const kind = body.kind as Kind;
  const table = tableFor(kind);
  try {
    const { data: booking, error: lookupError } = await supabaseAdmin.from(table).select('*').eq('id', body.id).single();
    if (lookupError || !booking) return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    if (kind === 'resource' && booking.block_booking_id) return NextResponse.json({ success: false, error: 'Block bookings must be managed as a whole.' }, { status: 409 });
    if (booking.status === 'pending_payment') return NextResponse.json({ success: false, error: 'Checkout is in progress. Wait for it to finish or expire.' }, { status: 409 });

    if (body.refund) {
      if (booking.payment_status !== 'paid' && booking.payment_status !== 'refunded') return NextResponse.json({ success: false, error: 'This booking has no paid Stripe payment to refund.' }, { status: 409 });
      if (booking.payment_status === 'refunded' && !booking.stripe_refund_id) return NextResponse.json({ success: false, error: 'This booking is marked refunded but has no linked refund. Reconcile it in Stripe.' }, { status: 409 });
      if (!booking.stripe_session_id) return NextResponse.json({ success: false, error: 'No Stripe checkout is linked to this booking.' }, { status: 409 });
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(booking.stripe_session_id);
      const paymentIntent = session.payment_intent;
      if (session.mode !== 'payment' || session.payment_status !== 'paid' || session.currency !== 'gbp' ||
          session.metadata?.booking_id !== booking.id || !paymentIntent ||
          session.amount_total !== Math.round(Number(booking.amount) * 100)) {
        return NextResponse.json({ success: false, error: 'Stripe payment does not match this booking.' }, { status: 409 });
      }
      const intentId = typeof paymentIntent === 'string' ? paymentIntent : paymentIntent.id;
      let refund: Stripe.Refund | null = booking.stripe_refund_id ? await stripe.refunds.retrieve(booking.stripe_refund_id) : null;
      if (!refund) {
        // Recover a refund created before a failed database write, including after
        // Stripe's idempotency window has expired.
        const previous = await stripe.refunds.list({ payment_intent: intentId, limit: 100 });
        refund = previous.data.find(candidate => candidate.metadata?.booking_id === booking.id &&
          candidate.metadata?.booking_kind === kind && candidate.amount === session.amount_total) ?? null;
      }
      refund ??= await stripe.refunds.create({ payment_intent: intentId, metadata: { booking_id: booking.id, booking_kind: kind } }, { idempotencyKey: `admin-full-refund-${kind}-${booking.id}` });
      const refundStatus = refund.status === 'succeeded' ? 'succeeded' : refund.status === 'failed' ? 'failed' : refund.status === 'canceled' ? 'canceled' : 'pending';
      const { data: updated, error } = await supabaseAdmin.from(table).update({
        status: 'cancelled', stripe_refund_id: refund.id, refund_status: refundStatus,
        payment_status: refundStatus === 'succeeded' ? 'refunded' : 'paid',
        admin_cancelled_at: booking.admin_cancelled_at || new Date().toISOString(),
      }).eq('id', booking.id).select('id, status, payment_status, stripe_refund_id, refund_status').single();
      if (error) throw error;
      await dispatchCancellationNotifications(5).catch(() => console.error('Cancellation email dispatch deferred'));
      return NextResponse.json({ success: true, booking: updated });
    }

    if (booking.stripe_refund_id) return NextResponse.json({ success: false, error: 'A refund already exists for this booking. Refresh its status instead.' }, { status: 409 });
    if (booking.status === 'cancelled') return NextResponse.json({ success: true, booking });
    const { data: updated, error } = await supabaseAdmin.from(table).update({ status: 'cancelled', admin_cancelled_at: new Date().toISOString() })
      .eq('id', booking.id).in('status', ['confirmed', 'completed']).select('id, status, payment_status, refund_status').single();
    if (error || !updated) return NextResponse.json({ success: false, error: 'Booking could not be cancelled.' }, { status: 409 });
    await dispatchCancellationNotifications(5).catch(() => console.error('Cancellation email dispatch deferred'));
    return NextResponse.json({ success: true, booking: updated });
  } catch (error) {
    console.error('Admin booking cancellation/refund failed:', error);
    return NextResponse.json({ success: false, error: 'Cancellation or refund failed. Check the booking and Stripe before retrying.' }, { status: 500 });
  }
}
