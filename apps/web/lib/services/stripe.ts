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
  // Persist once with the booking so retries send identical Stripe parameters.
  expiresAt: number;
  appUrl?: string;
  coupon?: { code: string; subtotalMinor: number; discountMinor: number; totalMinor: number };
}): Promise<{ sessionId: string; url: string }> {
  if (!Number.isSafeInteger(params.expiresAt) || params.expiresAt <= 0) {
    throw new Error('A fixed checkout expiry is required');
  }
  const stripe = getStripe();
  const appUrl = params.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: params.customerEmail,
    line_items: [{
      price_data: {
        currency: 'gbp',
        product_data: {
          name: params.description,
          ...(params.coupon ? { description: `Original £${(params.coupon.subtotalMinor / 100).toFixed(2)} · ${params.coupon.code}: -£${(params.coupon.discountMinor / 100).toFixed(2)}` } : {}),
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
      ...(params.coupon ? { coupon_code: params.coupon.code, subtotal_minor: String(params.coupon.subtotalMinor), discount_minor: String(params.coupon.discountMinor) } : {}),
    },
    success_url: `${appUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}&ref=${params.bookingReference}`,
    cancel_url: `${appUrl}/booking-cancel?ref=${params.bookingReference}&service=${params.serviceType}`,
    expires_at: params.expiresAt,
  }, { idempotencyKey: `${params.bookingKind ? 'group' : 'resource'}-checkout-${params.bookingId}` });

  if (!session.url) throw new Error('Checkout URL unavailable');
  return { sessionId: session.id, url: session.url! };
}

export function verifyWebhookSignature(body: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  return getStripe().webhooks.constructEvent(body, signature, secret);
}
