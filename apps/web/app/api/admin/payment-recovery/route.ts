import { NextResponse } from 'next/server';
import { isAdminMutationRequest } from '@/lib/security/admin-auth';
import { reconcileCheckoutAttempts } from '@/lib/services/checkout-attempts';
import { dispatchBookingNotifications } from '@/lib/services/booking-outbox';
import { dispatchCancellationNotifications } from '@/lib/services/cancellation-outbox';
import { reconcilePendingRefunds } from '@/lib/services/refund-recovery';

export async function POST(request: Request) {
  if (!await isAdminMutationRequest(request)) return NextResponse.json({ success: false }, { status: 403 });
  try {
    const checkouts = await reconcileCheckoutAttempts(20);
    const refunds = await reconcilePendingRefunds(10);
    const notifications = await dispatchBookingNotifications(10);
    const cancellationNotifications = await dispatchCancellationNotifications(10);
    return NextResponse.json({ success: true, checkouts, refunds, notifications, cancellationNotifications }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Recovery needs operator attention' }, { status: 503 });
  }
}
