import { getStripe } from '@/lib/services/stripe';
import { supabaseAdmin } from '@/lib/services/supabase';

/** Reconcile asynchronous refunds even when Stripe's refund webhook is not configured. */
export async function reconcilePendingRefunds(limit = 10) {
  let inspected = 0, updated = 0, failed = 0;
  for (const table of ['bookings', 'group_session_bookings'] as const) {
    const { data: bookings, error } = await supabaseAdmin.from(table)
      .select('id, stripe_refund_id')
      .eq('refund_status', 'pending')
      .not('stripe_refund_id', 'is', null)
      .limit(limit);
    if (error) throw error;
    for (const booking of bookings ?? []) {
      inspected++;
      try {
        const refund = await getStripe().refunds.retrieve(booking.stripe_refund_id);
        const refundStatus = refund.status === 'succeeded' ? 'succeeded' : refund.status === 'failed' ? 'failed' : refund.status === 'canceled' ? 'canceled' : 'pending';
        if (refundStatus === 'pending') continue;
        const { error: updateError } = await supabaseAdmin.from(table).update({
          refund_status: refundStatus,
          payment_status: refundStatus === 'succeeded' ? 'refunded' : 'paid',
        }).eq('id', booking.id).eq('stripe_refund_id', refund.id).eq('refund_status', 'pending');
        if (updateError) throw updateError;
        updated++;
      } catch { failed++; }
    }
  }
  return { inspected, updated, failed };
}
