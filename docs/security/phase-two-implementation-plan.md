# Phase two: abuse protection, guest access and authoritative pricing

Date: 2026-09-22. **Implementation approved and completed locally; not provisioned or deployed.** The design below remains the planning baseline. See [implementation and verification status](phase-two-implementation-status.md) for delivered scope and remaining release gates.

This extends the [first remediation batch](remediation-progress-2026-09-22.md) and [checkout plan](../features/checkout-implementation-plan.md). Preserve its access restrictions; do not restore unsafe legacy endpoints to make old flows work. Existing local fixes still require their own deployment review. Planning these additions must not delay approved containment of current production exposure.

## Confirmed requirements and proposed decisions

- Sign-in remains optional. Guests receive confirmation and payment documents without creating an account.
- All paid booking types and paid add-ons are eligible for COACH15/COACH20 under the agreed campaign rules. Rate limiting and ownership controls do not impose a new sign-in requirement.
- Venue hours are Monday–Friday 15:00–23:00, off-peak 15:00–17:00; Saturday–Sunday 09:00–23:00, all peak. Interpret these in Europe/London, not the browser/server timezone.
- No changes to current prices, cancellation/refund entitlement or past paid bookings are approved by this document.
- Proposed below, requiring sign-off before rollout: managed shared rate-limit store and budget, initial traffic limits, fail-closed write behaviour during a store outage, guest link/session lifetimes, single-booking checkout as the first safe release, and pricing precedence after comparing actual admin configuration. No new service subscriptions or migrations are authorised here.

## A. Distributed rate limiting

### Design

Replace the process-local Map as the authoritative limiter with a shared Redis-compatible store and an atomic token-bucket/sliding-window implementation. Provider choice and region remain open; select only after checking cost, latency, atomic-operation support and deployment compatibility. Use separate development/preview/production namespaces and server-only credentials. Do not use eventually consistent per-region counters for strict global caps. Redis documents atomic rate-limiting patterns: [rate limiter guide](https://redis.io/docs/latest/develop/use-cases/rate-limiter/).

Introduce one server helper returning allow/deny, retry time and dependency-health state. Apply it before email, reservation or Stripe work. Combine trusted-proxy client IP, verified user/guest-session identity where available, and endpoint-specific subjects. Never trust arbitrary forwarded headers; explicitly document and test the hosting proxy boundary. Missing trusted identity must not yield a bypass. Use keyed hashes rather than raw emails/IPs in storage keys; do not log tokens or full request bodies. TTLs bound counter retention, and bounded input/key lengths prevent store abuse.

### Starting limits — proposals, not established traffic requirements

| Operation | Proposed starting limits | Behaviour |
|---|---|---|
| Admin login | 5 attempts / 15 minutes per trusted IP | Short cooldown; avoid permanent/global account lockout exploitable by attackers |
| New booking / checkout attempt | 10 / minute per IP, plus 5 / minute per verified user or guest session | Count attempts, preserve idempotent retry semantics |
| Enquiry submission | 5 / 10 minutes per IP, 3 / hour per normalised email hash | Generic errors; email address remains unverified, not ownership proof |
| Guest-link requests | 5 / 15 minutes per IP; 3 / hour per booking-recipient hash; 60-second resend spacing | Same generic response whether booking exists or not |
| Guest-link exchange | 10 / 15 minutes per IP | Reject invalid/expired/replayed tokens; no customer details |
| Private booking reads / PDF download | 60 / minute per verified session plus a generous IP ceiling | Recheck scope on every request |
| Public slots / quote | 60 / minute per IP | Also cap date range, requested resources and request size |

Add monitored service-wide budget alerts and a separately reviewed emergency circuit breaker; do not introduce a low shared quota that one attacker can exhaust to lock out all customers. Tune IP limits for schools/families sharing networks. Return HTTP 429 with Retry-After for actual throttling and 503 for dependency failure; never pretend an enquiry or booking succeeded.

### Outages, webhooks and operations

Proposed policy: if the shared limiter fails, deny new admin logins, guest-link issuance/exchange, email submissions and new payment/reservation mutations temporarily with 503. Existing authorised read-only access may use a bounded local fallback plus trusted edge protection. Authentication/ownership checks never fail open. Publish a support path and outage alert. Checkout already paid must still be fulfilled.

Stripe/Resend webhooks do not share browser/IP quotas. Keep bounded request sizes, signature checks and durable deduplication; use provider-specific capacity controls. Do not acknowledge unpersisted work as processed. Return retryable failures when processing cannot complete, and never drop valid payment events just because the general limiter is down. [Stripe webhook guidance](https://docs.stripe.com/webhooks).

Tests: concurrent requests across two worker processes share limits; spoofed forwarding headers fail; TTL/reset and Retry-After are correct; users behind a shared IP remain usable; missing/rotated credentials and store timeout exercise documented outage behaviour; valid webhooks still settle payments. Inspect only redacted aggregate metrics in production; load tests use an isolated environment.

## B. Secure guest-booking access and account linking

### Customer flow

1. Guest books without an account. Bind the draft/checkout to an opaque browser capability stored in an HttpOnly, Secure, SameSite cookie; never put long-lived credentials in localStorage. This capability permits only that draft/attempt and its minimal completion view, not arbitrary booking history or refunds.
2. Confirmation email offers a “Manage booking” entry point. On another device, request a fresh link using booking reference plus email. The response is always generic; send only to the recipient already stored on that matching booking, not a caller-supplied replacement. Never reveal whether an email/reference exists.
3. Generate a cryptographically random 256-bit token scoped to one booking, purpose and expiry. Persist its hash, not plaintext, with consumed/revoked timestamps. Proposed link lifetime: 15 minutes. Rate-limit issue/resend/exchange; replace or revoke superseded links consistently.
4. Link opens a minimal first-party page without analytics or third-party assets. Prefer a URL fragment for the secret, remove it from browser history promptly, then submit it only by same-origin POST. GET/prefetch/email scanners must not consume it or perform booking actions. Explicit “Continue” exchanges it atomically once for a scoped server-side guest session. A forwarded link is a bearer credential and grants its scope until consumed/expired: state this risk clearly.
5. Proposed guest session: 30-minute inactivity timeout, 24-hour absolute maximum, revocable per booking. Recheck expiry/revocation and booking scope for each view/download. Use no-store and no-referrer on access pages; exclude credentials from application, proxy, analytics and error logs. PDF endpoints must not become public URLs.

Views expose only that booking's necessary details, status, receipt and confirmation PDF. The initial scope is **view/download only**. Keep cancellation support-assisted until a distinct, audited cancellation/refund flow checks entitlement, current state and fresh verification. A GET or view token must never trigger cancellation or refund. Payment retry needs its own mutation scope, same-origin/CSRF protection and revalidation of availability/quote/current payment attempt.

Preserve the chosen transactional sender and monitored Reply-To. Access emails should clearly state purpose, expiry, support contact and what to do if not requested. Do not include sensitive player details in the subject. Links are transactional, not marketing consent. Ensure mail failure allows a rate-limited resend without repeating payment or booking creation.

### Ownership and data model

Add reviewed, private access-grant/session records with explicit resource-booking or group-booking foreign keys, token hashes, scopes, TTLs and revocation; avoid unchecked polymorphic IDs. Browser roles must not list token/session tables. Apply least-privilege grants, RLS and service-handler checks: the service role bypasses RLS, so server checks remain mandatory. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

For new signed-in bookings, derive identity through server-verified Auth, never posted user IDs or user-editable metadata. Resolve `bookings.user_id -> public.users` provisioning explicitly and introduce equivalent group-booking ownership through a reviewed additive migration. Do not assume Auth IDs already have matching profiles or grant an admin role while provisioning.

To attach a guest/legacy booking to an account, require both verified account identity and a fresh booking-email proof, plus explicit customer confirmation. Bind the exchange to that account and booking; reject conflicting existing ownership and concurrent claims. No bulk historical linking by supplied/matching email alone. Legacy records with unavailable/wrong email require an audited support process; do not change recipients based on an unauthenticated request. Retain historic booking records and amounts unchanged.

Tests: two customers plus a guest cannot cross-read; guessed IDs/emails/Stripe session IDs give no access; token replay, expiry, scanner GETs, concurrent exchange, revocation and forwarded-link scenarios behave as documented; email failure never duplicates a booking; claims cannot overwrite another owner; downloads remain private. Verify RLS with real synthetic-role database tests, not mocks alone.

## C. Authoritative availability, pricing and payment integrity

### Problems to resolve

Current slot generation reads admin availability/pricing rules and overrides while resource checkout computes hardcoded rates. Slot generation also mixes local-date and UTC operations; browser checkout sends timezone-less timestamps. Price display and charge must use one contract. Multi-slot confirmation currently creates several checkouts but navigates to only one. These are prerequisites to enabling coupons, not cosmetic issues.

### Single server quote contract

Create a shared quote/availability service used by slot display, final review, checkout and admin previews. Input identifies service/resource, venue date, start wall-clock time, duration and supported add-ons (or a dated group session plus players). Do not accept client prices, percentages or user IDs as authoritative.

Validate service enum, active resource/type compatibility, full interval within approved availability, date validity, future start, duration and increment, buffers, overlapping blocks/overrides and capacity. Check every interval, not only its starting point. Validate group/masterclass ages and capacity from current admin settings. Bound advance-booking range and slot-query work; exact maximum range/duration follow admin policy, not an invented hardcoded rule.

Convert explicit Europe/London wall-clock values to UTC using a tested timezone-aware library. Reject nonexistent or ambiguous local times unless explicitly disambiguated. Keep venue date separate from UTC instants. Inventory historical timestamp conventions before rollout: **do not shift existing bookings automatically**. Compare synthetic winter/summer and DST cases with current records/configuration in a read-only audit first.

Proposed price precedence for owner/admin review:

1. Closed/blocked/unavailable means no quote regardless of a custom price.
2. Valid admin slot-specific price override, with documented units (per slot versus hourly).
3. Applicable active pricing rule using the existing lower-number-first priority convention; reject conflicting equal-priority overlaps rather than guessing.
4. Explicit service/resource base-rate schedule matching approved published rates. A missing or ambiguous rate fails closed; no silent generic-lane fallback for other services.

Use integer GBP pence. Split duration at rate boundaries and sum the authorised intervals. Example using current hardcoded lane rates (not a price change): weekday 16:00–18:00 is one £15 off-peak hour plus one £25 peak hour = £40, not £30. Check any admin override before treating that example as the actual quote. Weekend 09:00–11:00 is entirely peak. Define partial-slot/proration rules from existing admin configuration before supporting them.

Return/store a versioned quote with expiry, interval/add-on breakdown, original subtotal, approved promotion snapshot, discount, net total and policy version. Proposed quote review validity: 10 minutes; it is not an inventory hold. If price changes before reservation, show the new quote and require acceptance. Once a valid Checkout Session is created, preserve its agreed quote through the payment hold; do not reprice paid or in-flight sessions silently. All paid booking types remain coupon-eligible, with cross-type usage limits and consistent minor-unit rounding.

### Reservation and Stripe state machine

- Proposed first release supports **one payable booking per checkout**, including duration and add-ons; show a clear UI limit instead of silently discarding other slots. Owner approval is required because this narrows the present multi-select UI. Alternative: a parent order with atomic multi-slot reservation and one Stripe payment, a separate larger work package.
- Atomically recheck/reserve inventory and campaign usage before payment. Preserve database overlap/capacity constraints; optimistic read-then-insert is insufficient for all races.
- Persist an owner/capability-bound checkout attempt, quote and stable idempotency key. Create/retrieve the matching Stripe session, persist its exact ID successfully, **then** return its URL. Same key means same parameters; changes require a new reviewed attempt. [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests).
- If Stripe times out or session persistence fails, do not return an untracked payment link or release capacity while payment may still settle. Reconcile the attempt with Stripe, retry with its stable key, or expire an unpaid session and verify terminal state before release. A durable reconciliation job must recover process crashes.
- Validated webhook or server-retrieved fallback verifies exact session/attempt, paid status, mode, currency, subtotal, authorised discount and total. Persist event/transition idempotently; late events cannot cancel another attempt. Queue notification delivery durably so email failure is retryable without duplicate fulfilment.
- Refunds use a separate idempotent, permission-checked operation and verified provider state. Never mark refunded solely on a cancellation request. Receipts/admin totals reflect actual paid/refunded money.

Tests cover off-peak boundary crossing, weekend pricing, blocked overlap mid-booking, inactive/wrong resource, configured overrides/priority ties, spoofed client price, negative/zero/oversized duration, timezone-less legacy inputs, DST, age/capacity limits, two clients racing the final slot, duplicate submit/event, expired quote, lost Stripe response, failed session persistence, process crash, late payment and actual amount reconciliation in emails/PDFs. Use Stripe test mode and isolated synthetic database records.

## Delivery order, rollback and acceptance

| Phase | Deliverable | Release gate |
|---|---|---|
| 0 | Confirm proposals and inspect real configuration without customer exports | Provider/budget, limits/outages, TTLs, pricing units/precedence and single-booking versus order decision recorded |
| 1 | Shared limiter adapter and observability | Multi-worker concurrency/outage tests; start public-read tuning in shadow mode, never weaken existing auth |
| 2 | Private owner/guest grants and read/download flow | Synthetic-user RLS/access/replay tests; keep legacy unsafe endpoints retired |
| 3 | Unified quote engine and preview comparison | Existing prices/hours preserved; mismatches reviewed before it controls charges |
| 4 | Attempt persistence, reconciliation and durable fulfilment | Crash/retry/late-event tests and protected checkout end-to-end pass |
| 5 | Preview and controlled rollout | Browser checks, migrations/rollback rehearsal, rotated credentials, alerts and support instructions |
| 6 | Coupon enablement | Both codes tested across all booking types; launch dates/refund-restoration decision complete |

Use additive migrations and independent switches for guest links and new checkout. If reverting, stop new attempts/links while keeping valid in-flight payment verification, reconciliation and scoped sessions functioning. Never roll back to public lists, ID-only cancellation, email-only ownership or known incorrect charging. Limiter rollback must follow the explicit outage policy, not silently remove protection. Keep old monetary records immutable and maintain audit history.

Definition of done: scoped access works without forced sign-in; shared limits work across workers; UI quote, Stripe, database, email and PDF agree; recovery handles failures without duplicate charges or lost paid bookings; preview tests and owner decisions are recorded. This document introduces no code, database, provider or environment changes.
