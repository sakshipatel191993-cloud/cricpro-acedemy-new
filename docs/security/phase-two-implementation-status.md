# Phase-two security implementation — 2026-09-22

Implemented locally on `fix/live-coaching-weekday-hours`. Not committed, deployed, provisioned or applied to production. Keep security review documents private until publication is reviewed.

Follow-on update: [admin coupon management and checkout integration](../features/admin-coupons.md) has since been implemented locally and tested. The coupon implementation item below records the phase-two baseline, not the latest coupon status; activation is still pending.

## Delivered

- Shared Redis REST limiter: atomic sliding windows, HMAC identifiers, trusted Vercel IP input, bounded local read fallback, explicit development-only write fallback. Production writes fail closed if the shared store is unavailable. Separate namespaces and server-only credentials are required.
- Bounded JSON streaming for exposed mutation bodies. Admin login, enquiries, booking/quote requests and guest access use shared policies.
- Secure guest access for resource and group bookings: random hashed capabilities, single-use 15-minute links, scoped HttpOnly sessions, idle/absolute expiry, revocation, private PDFs, verified account linking and minimal payment verification responses. No email-only or ID-only access.
- Authoritative London-time resource quotes: server-derived integer-pence totals, schedule/rate/availability validation, immutable snapshots, ten-minute capabilities and atomic inventory reservation. Browser checkout reviews the whole duration and reserves one booking at a time.
- Durable Stripe attempts, verified session attachment, unknown-outcome preservation, recovery and transactional notification outbox with stable provider idempotency. Group form retries share a browser-bound request key and reject changed details.
- Protected admin recovery and secret-authenticated scheduler endpoint; scheduler itself is not provisioned.

## Verification evidence

- 36 Node test-runner entries passed with `ALLOW_ISOLATED_PG_TEST=true`, including the two PostgreSQL concurrency tests. Other provider tests use mocks; they are not real provider end-to-end verification.
- Four migrations applied to a disposable PostgreSQL 15 cluster at localhost:55439, using synthetic data and the application's existing TEXT booking IDs. Privilege/replay/revocation, confirmation rollback and outbox lease tests passed.
- Separate quote race tests passed: same quote creates one booking; conflicting quotes allow one reservation. Eight guest-token exchanges produce one session; concurrent outbox workers claim different jobs. Concurrent group inserts consume one place.
- TypeScript and Next.js production build passed (56 static pages). Existing middleware naming deprecation is non-blocking. `git diff --check` passed.
- Local production-mode browser smoke: secure-access form renders with no captured console errors. HTTP checks confirm no-store/no-referrer on that page, unauthorised scheduler/admin booking reads denied, and private access fails closed while disabled. No customer details, payments or messages used.
- Browser verification used the available in-app browser because the standalone agent-browser CLI was unavailable. Full signed-in/provider/browser checkout remains a release gate, not a completed check.

## Before production

1. Rotate previously shared server/provider credentials and verify strong admin authentication configuration.
2. Review/apply the four additive migrations in an isolated preview database first, then production under the approved rollout. Do not remove the new recovery or access tables during rollback.
3. Configure a strongly consistent Redis REST store and `RATE_LIMIT_KEY_SECRET` (32+ characters), separate `RATE_LIMIT_NAMESPACE` values and REST credentials. Test the Lua script against that real store and verify trusted proxy headers. Monitor false positives and outages.
4. Audit existing timestamp conventions and price units before setting `BOOKING_TIMEZONE_VERIFIED=true`, `BOOKING_PRICE_UNITS=hourly` and `AUTHORITATIVE_QUOTES_ENABLED=true`. Do not blindly shift historic bookings. Enable `GUEST_BOOKING_ACCESS_ENABLED=true` only after its migration/provider checks.
5. Test Stripe test-mode timeouts/recovery, controlled-recipient email retries, guest email exchange/account linking and complete customer/admin browser flows against isolated data.
6. Configure the authenticated recovery schedule, alerts, support ownership and private outbox payload retention. Verify provider runtime limits and measure bounded-batch duration.

Remaining separate work: individual admin identities/MFA, comprehensive nonce-based CSP, provider suppression/delivery operations, backup recovery verification, authorised cancellation/refund workflows and coupon implementation. COACH15/COACH20 remain documented policy only; no campaigns were activated.

References: [pricing rollout](authoritative-quote-rollout.md), [payment recovery operations](payment-recovery-operations.md), [original plan](phase-two-implementation-plan.md).
