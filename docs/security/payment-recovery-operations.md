# Payment recovery and confirmation delivery

Local implementation, 2026-09-22. Not deployed; do not enable without the reviewed `20260922124305_checkout_recovery.sql` migration and isolated tests. All tables/RPCs are service-role-only with RLS and explicit browser-role revocation. No provider credentials are stored in these tables.

## Recovery contract

Booking creation persists its inventory hold, then an immutable checkout request (including expiry and application origin) before contacting Stripe. A stable booking-scoped idempotency key prevents duplicate session creation for identical retries. The session must be retrieved/validated and attached to both booking and attempt in one database transaction before returning its URL. A timeout or write failure leaves the hold intact: a missing session ID is not evidence that no charge can occur.

Group/masterclass forms now retain one request UUID for the unchanged in-memory form draft and bootstrap a private 256-bit HttpOnly browser cookie before reservation. The booking primary key is derived from both values, so a public form UUID alone cannot retrieve a checkout. The fourth migration `20260922130038_group_checkout_idempotency.sql` adds an immutable submitted-data fingerprint and checkout description/type snapshot. Concurrent retries resolve the same row; changed details with a reused request ID fail with 409. This also handles the capacity trigger rejecting a racing duplicate before the primary-key check. A new/changed draft intentionally receives a new request ID. Reloading the page discards the in-memory draft: after an unknown outcome, use support/recovery rather than starting another draft. Rate limiting alone is not idempotency.

The protected `POST /api/admin/payment-recovery` endpoint runs a bounded batch of 20 checkout attempts and 10 notification jobs. Use an authenticated admin session from the site's same origin; GETs, cross-origin requests and unauthenticated callers cannot run it. Response contains counts only, not payment URLs, personal data or tokens. Repeat as needed; least-recently-inspected attempts are processed first to avoid starving newer work behind open checkouts.

An automatic recurring worker/alert integration is **not configured** by this change. Before production enablement, arrange and verify an authorised recurring invocation or an actively staffed recovery runbook. A durable table without a running consumer is not automatic recovery. Stripe paid webhooks also attempt a small notification batch after committing fulfilment, but webhook traffic alone is not an adequate retry schedule.

For a scheduler, `GET /api/internal/payment-recovery` accepts only an exact `Authorization: Bearer <CRON_SECRET>` header. Configure a random server-only secret of at least 32 characters; missing, weak or incorrect credentials return 401 without work. Do not put the secret in query strings. This route runs the same bounded batches without weakening admin middleware. Proposed frequency is every five minutes, subject to provider runtime/plan limits; configure a timeout suitable for the measured batch duration and alert on 503s/deferred work. No schedule or paid plan is created by this implementation.

Recovered paid sessions use the same strict verification/transaction as signed webhooks. Only provider-verified expired sessions release holds. Never cancel or mark refunded simply because a local timer elapsed. Unknown attempts older than 23 hours are not recreated (Stripe can discard idempotency keys after 24 hours); they require operator reconciliation in Stripe. When original expiry is already past and Stripe cannot replay creation, do not alter its expiry/key to bypass the error. Look up the original attempt with provider tools/support and establish its actual terminal state first.

Legacy pending rows with no persisted attempt or session are preserved for manual reconciliation. No broad expiry cleanup is safe for those rows. Bookings that crash before the durable attempt insert also require review. No automatic historical backfill or customer-data export is performed.

## Durable confirmation email

Verified confirmation and outbox insertion are one PostgreSQL transaction. Resource bookings queue customer/admin jobs; group/masterclass bookings retain their existing customer-confirmation behaviour. Duplicate confirmation events cannot enqueue duplicates. Existing confirmed historical records are not automatically re-emailed.

Workers claim jobs with row locks and five-minute leases. The exact rendered request, including base64 PDF attachments, is persisted before the first provider call; retries use identical bytes and a deterministic Resend idempotency key. A failed acknowledgement can therefore be retried without regenerating different documents. Failed work gets bounded exponential backoff. Invalid/permanent provider responses or exhausted retries require operator attention. Unknown sends older than 23 hours stop automatic retries to avoid sending twice after Resend's 24-hour idempotency retention. `sent` means accepted by Resend, not proof of inbox delivery; use the provider's delivery/bounce record for delivery investigation.

Inspect `needsAttention`/`deferred` counts and service-role-only outbox state. Verify provider acceptance before manually resending an uncertain old job. Do not reset first-send timestamps or change idempotency keys to force a retry. Do not log payloads, attachments, access links or credentials. Stored email payloads contain personal information; approve and implement retention/cleanup before rollout (proposed: remove rendered payloads after 30 days, retain minimal delivery audit under the business retention policy). Suppression/bounce/complaint processing remains a separate delivery-operations gate; this change does not bypass provider suppression.

## Deployment gates / rollback

- Apply additive migration in isolated/preview database first; test transaction rollback, RPC grants, role denial, concurrent claims and replay with synthetic records.
- Test Stripe lost-response/session-save failure and real test-mode recovery without charging a real customer. Test Resend timeout/acknowledgement loss with controlled recipients.
- Apply the fourth group-request migration and test same-draft concurrent submissions, changed-data rejection, cookie bootstrap and expired/blocked-cookie browser behaviour. New drafts remain intentionally distinct; idempotency is not a one-booking-per-person restriction.
- Verify the shared limiter and guest-access migrations/configuration required by booking routes.
- Set up an authenticated recovery schedule plus alerts/support ownership; test an outage recovery before rollout.
- Stop new checkouts if rolling back. Keep signed fulfilment, scoped guest access and recovery working for existing attempts/outbox jobs. Do not deploy old confirmation code that drops queued work or releases unknown payment holds.

Sources: [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
