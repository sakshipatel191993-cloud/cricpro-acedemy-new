import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { verifyWebhookSignature } from '@/lib/services/stripe';
import { confirmBooking } from '@/lib/services/confirm-booking';

export const config = { api: { bodyParser: false } };

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

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as { id: string; metadata?: { booking_id?: string } };
        const bookingId = session.metadata?.booking_id;

        if (!bookingId) break;

        try {
          await confirmBooking(bookingId, session.id);
        } catch (error) {
          console.error('Failed to confirm booking:', error);
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as { metadata?: { booking_id?: string } };
        const bookingId = session.metadata?.booking_id;
        if (!bookingId) break;

        await supabaseAdmin
          .from('bookings')
          .update({ status: 'cancelled', payment_status: 'failed' })
          .eq('id', bookingId)
          .eq('status', 'pending_payment');
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as { payment_intent?: string };
        if (!charge.payment_intent) break;

        // Find booking by looking up the payment intent via Stripe
        console.log('Refund processed for payment intent:', charge.payment_intent);
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
