import { supabaseAdmin } from '@/lib/services/supabase';
import { createCheckoutSession, getStripe } from '@/lib/services/stripe';
import { confirmBooking } from '@/lib/services/confirm-booking';
import { confirmGroupBooking } from '@/lib/services/confirm-group-booking';
import { confirmBlockBooking, expireBlockBooking } from '@/lib/services/block-bookings';

type CheckoutParams = Parameters<typeof createCheckoutSession>[0];
type Attempt = { id: string; resource_booking_id: string | null; group_booking_id: string | null; block_booking_id?: string | null; params: CheckoutParams; stripe_session_id: string | null; created_at: string };

export function checkoutAppUrl(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  // Production keeps its configured canonical host. Local checkouts must return
  // to the host and port that actually created the reservation.
  return process.env.NODE_ENV === 'production' && configured ? new URL(configured).origin : requestOrigin;
}

// Called only by server-side booking creation after its reservation is persisted.
// The attempt survives a lost Stripe response or a failed session-ID write.
export async function startPersistedCheckout(input: CheckoutParams) {
  const group = input.bookingKind === 'group_session';
  const block = input.bookingKind === 'block';
  const id = `${block ? 'block' : group ? 'group' : 'resource'}:${input.bookingId}`;
  const params = { ...input, appUrl: input.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000' };
  const { error } = await supabaseAdmin.from('checkout_attempts').upsert({
    id, resource_booking_id: group || block ? null : input.bookingId,
    ...(block ? { block_booking_id: input.bookingId } : {}),
    group_booking_id: group ? input.bookingId : null, params,
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error('Unable to persist checkout attempt');
  const { data, error: readError } = await supabaseAdmin.from('checkout_attempts').select('*').eq('id', id).single();
  if (readError || !data) throw new Error('Unable to recover checkout attempt');
  return resumeCheckoutAttempt(data as Attempt);
}

export async function resumeCheckoutAttempt(attempt: Attempt) {
  let sessionId = attempt.stripe_session_id;
  if (!sessionId) {
    // Stripe may prune idempotency keys after 24h. Never create a second payment
    // after that safety window, even when the outcome of the first is unknown.
    if (Date.now() - new Date(attempt.created_at).getTime() >= 23 * 60 * 60 * 1000) {
      throw new Error('Checkout requires manual provider reconciliation');
    }
    const checkout = await createCheckoutSession(attempt.params);
    sessionId = checkout.sessionId;
  }
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  const p = attempt.params;
  if (session.metadata?.booking_id !== p.bookingId || session.mode !== 'payment' ||
      session.currency !== 'gbp' || session.amount_total !== Math.round(Number(p.amount) * 100) ||
      (session.metadata?.booking_kind === 'group_session') !== !!attempt.group_booking_id ||
      (session.metadata?.booking_kind === 'block') !== !!attempt.block_booking_id) {
    throw new Error('Checkout does not match persisted attempt');
  }
  if (!attempt.stripe_session_id) {
    const { error } = await supabaseAdmin.rpc(attempt.block_booking_id ? 'attach_block_checkout' : 'attach_checkout_attempt', {
      p_attempt_id: attempt.id, p_session_id: session.id,
    });
    if (error) throw new Error('Unable to persist checkout session');
  }
  if (session.payment_status === 'paid') {
    if (attempt.block_booking_id) await confirmBlockBooking(p.bookingId, session.id);
    else if (attempt.group_booking_id) await confirmGroupBooking(session);
    else await confirmBooking(p.bookingId, session.id);
  } else if (session.status === 'expired') {
    if (attempt.block_booking_id) {
      await expireBlockBooking(p.bookingId, session.id);
      return { sessionId: session.id, url: null };
    }
    const table = attempt.group_booking_id ? 'group_session_bookings' : 'bookings';
    const { error: expireError } = await supabaseAdmin.from(table)
      .update({ status: attempt.group_booking_id ? 'expired' : 'cancelled', payment_status: 'failed' })
      .eq('id', p.bookingId).eq('stripe_session_id', session.id).eq('status', 'pending_payment');
    if (expireError) throw expireError;
  }
  if (session.status !== 'open' || !session.url) return { sessionId: session.id, url: null };
  return { sessionId: session.id, url: session.url };
}

export async function reconcileCheckoutAttempts(limit = 20) {
  const { data, error } = await supabaseAdmin.from('checkout_attempts').select('*')
    .eq('resolved', false).order('last_reconciled_at', { nullsFirst: true }).order('created_at').limit(Math.min(limit, 50));
  if (error) throw error;
  let recovered = 0, needsAttention = 0;
  for (const attempt of data ?? []) {
    try {
      const result = await resumeCheckoutAttempt(attempt as Attempt);
      if (!result.url) {
        const { error: saveError } = await supabaseAdmin.from('checkout_attempts')
          .update({ resolved: true }).eq('id', attempt.id);
        if (saveError) throw saveError;
      }
      recovered++;
    } catch {
      needsAttention++;
      // Leave inventory held. Do not log customer payloads, links or credentials.
    }
    const { error: auditError } = await supabaseAdmin.from('checkout_attempts')
      .update({ last_reconciled_at: new Date().toISOString() }).eq('id', attempt.id);
    if (auditError) throw auditError;
  }
  return { inspected: data?.length ?? 0, recovered, needsAttention };
}
