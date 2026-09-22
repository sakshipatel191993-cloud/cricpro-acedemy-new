import { timingSafeEqual } from 'node:crypto';
import { reconcileCheckoutAttempts } from '@/lib/services/checkout-attempts';
import { dispatchBookingNotifications } from '@/lib/services/booking-outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret || ''}`;
  const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
  if (!secret || secret.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(expected)
    || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return Response.json({ success: false }, { status: 401, headers });
  }
  try {
    const checkouts = await reconcileCheckoutAttempts(20);
    const notifications = await dispatchBookingNotifications(10);
    return Response.json({ success: true, checkouts, notifications }, { headers });
  } catch {
    console.error('security.payment_recovery_failed');
    return Response.json({ success: false, error: 'Recovery needs operator attention' }, { status: 503, headers });
  }
}
