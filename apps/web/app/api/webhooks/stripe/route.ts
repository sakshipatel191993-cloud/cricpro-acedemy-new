import type Stripe from 'stripe';
import { confirmBlockBooking, expireBlockBooking } from '@/lib/services/block-bookings';
import { confirmGroupBooking } from '@/lib/services/confirm-group-booking';
import { expireGroupCheckout } from '@/lib/services/session-checkout';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { getStripe, verifyWebhookSignature } from '@/lib/services/stripe';
import { confirmBooking } from '@/lib/services/confirm-booking';
import { dispatchBlockBookingNotifications, dispatchBookingNotifications } from '@/lib/services/booking-outbox';
import { dispatchCancellationNotifications } from '@/lib/services/cancellation-outbox';

export const maxDuration = 60;



export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event;
    try {
      event = verifyWebhookSignature(body, signature);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    let confirmedBlockId: string | null = null;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== 'paid') break;
        const bookingId = session.metadata?.booking_id;
        if (!bookingId) break;
        if (session.metadata?.booking_kind === 'block') {
          await confirmBlockBooking(bookingId, session.id);
          confirmedBlockId = bookingId;
        } else if (session.metadata?.booking_kind === 'group_session') {
          await confirmGroupBooking(session);
        } else {
          await confirmBooking(bookingId, session.id);
        }
        // Let failures return 500 so Stripe retries delivery.
        break;
      }
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id;
        if (!bookingId) break;
        if (session.metadata?.booking_kind === 'block') {
          await expireBlockBooking(bookingId, session.id);
        } else if (session.metadata?.booking_kind === 'group_session') {
          await expireGroupCheckout(bookingId, session.id);
        } else {
          const { error } = await supabaseAdmin.from('bookings')
            .update({ status: 'cancelled', payment_status: 'failed' })
            .eq('id', bookingId)
            .eq('stripe_session_id', session.id)
            .eq('status', 'pending_payment');
          if (error) throw error;
        }
        break;
      }

      case 'refund.created':
      case 'refund.updated':
      case 'refund.failed': {
        const refund = event.data.object as Stripe.Refund;
        const bookingId = refund.metadata?.booking_id;
        const kind = refund.metadata?.booking_kind;
        if (!bookingId || (kind !== 'resource' && kind !== 'group')) break;
        const table = kind === 'resource' ? 'bookings' : 'group_session_bookings';
        // Fetch current state so delayed webhook delivery cannot undo a newer status.
        const current = await getStripe().refunds.retrieve(refund.id);
        const refundStatus = current.status === 'succeeded' ? 'succeeded' : current.status === 'failed' ? 'failed' : current.status === 'canceled' ? 'canceled' : 'pending';
        const { error } = await supabaseAdmin.from(table).update({
          refund_status: refundStatus,
          payment_status: refundStatus === 'succeeded' ? 'refunded' : 'paid',
        }).eq('id', bookingId).eq('stripe_refund_id', refund.id);
        if (error) throw error;
        await dispatchCancellationNotifications(5).catch(() => console.error('Refund email dispatch deferred'));
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    // Fulfilment and outbox are committed together. Provider email outages must
    // not undo a paid booking; the authenticated recovery worker retries these.
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      if (confirmedBlockId) {
        await dispatchBlockBookingNotifications(confirmedBlockId).catch(() => console.error('Block booking notification dispatch deferred'));
      } else {
        await dispatchBookingNotifications(5).catch(() => console.error('Booking notification dispatch deferred'));
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
