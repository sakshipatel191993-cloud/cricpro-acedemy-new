import Stripe from 'stripe';

export const paymentsEnabled = process.env.PAYMENTS_ENABLED === 'true';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export async function createCheckoutSession(params: {
  bookingId: string;
  bookingReference: string;
  serviceType: string;
  amount: string;
  customerEmail: string;
  customerName: string;
  description: string;
  bookingKind?: 'group_session';
  expiresAt?: number;
}): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: params.customerEmail,
    line_items: [{
      price_data: {
        currency: 'gbp',
        product_data: {
          name: params.description,
          metadata: { booking_reference: params.bookingReference },
        },
        unit_amount: Math.round(parseFloat(params.amount) * 100),
      },
      quantity: 1,
    }],
    metadata: {
      booking_id: params.bookingId,
      ...(params.bookingKind ? { booking_kind: params.bookingKind, service_type: params.serviceType } : {}),
      booking_reference: params.bookingReference,
    },
    success_url: `${appUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}&ref=${params.bookingReference}`,
    cancel_url: `${appUrl}/booking-cancel?ref=${params.bookingReference}&service=${params.serviceType}`,
    expires_at: params.expiresAt ?? Math.floor(Date.now() / 1000) + 1800, // 30 min
  }, params.bookingKind ? { idempotencyKey: `group-checkout-${params.bookingId}` } : undefined);

  if (!session.url) throw new Error('Checkout URL unavailable');
  return { sessionId: session.id, url: session.url! };
}

export function verifyWebhookSignature(body: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  return getStripe().webhooks.constructEvent(body, signature, secret);
}
