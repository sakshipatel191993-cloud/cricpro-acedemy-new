# Checkout implementation and release plan

Date: 2026-09-22 | Baseline reviewed: `7d9ef86`

This is a plan, not evidence that features or security fixes have shipped. No coupons were created and no production settings/code were changed during documentation work.

## Work packages and dependencies

Detailed designs for distributed rate limiting, guest access and authoritative pricing are in the [phase-two security plan](../security/phase-two-implementation-plan.md). Proposed operational settings require approval; no implementation is implied by this plan.

| Order | Work package | Deliverable / exit gate |
|---|---|---|
| 0 | Initial policy approved; launch details pending | Follow approved coupon rules; set exact launch/expiry timestamps and confirm refund eligibility restoration before activation |
| 1 | Security prerequisites | Protect public booking/enquiry access and mutations; remove default admin credentials; rotate previously shared secrets; secure return URLs; upgrade vulnerable dependencies; distributed abuse protection |
| 2 | Quote and checkout integrity | Authoritative venue-time rate calculation across duration; current availability checks; solve multi-slot/multiple-checkout mismatch; owner/capability-bound idempotent checkout attempts |
| 3 | Data and shared fulfilment | Reviewed additive migrations for quote/discount/paid snapshots, identity mapping and guest drafts; unified verification rules for both booking families; historical compatibility |
| 4 | Optional sign-in | Accessible guest-first prompt, safe draft resume, secure owner linkage and private booking history; no promise of history before it works |
| 5 | Coupon configuration | Test-mode coupons/promotions for all paid booking types, including paid add-ons; checkout input and server-side campaign/usage validation |
| 6 | Presentation | Correct customer/admin summaries, receipts, PDFs and payment/refund reporting |
| 7 | Verify and release | Automated + manual tests in isolated test environment; approval of live campaign; deploy behind disabled flags; smoke test; staged activation and monitoring |

Security remediation is separate implementation work requiring approval. Documenting issues does not remediate them. Keep the detailed security report private until resolved; do not attach it to a public PR without review.

## Code touchpoints

- Quote/booking APIs: `apps/web/app/api/bookings/route.ts`, `group-session-bookings/route.ts`, `payments/create-session/route.ts`, `payments/verify-session/route.ts`.
- Shared Stripe and fulfilment: `apps/web/lib/services/stripe.ts`, `confirm-booking.ts`, `confirm-group-booking.ts`, `session-checkout.ts`.
- UX/auth: `apps/web/app/booking-confirm/page.tsx`, `components/sessions-page.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/account/page.tsx`, `lib/context/auth.tsx`.
- Documents/reporting: `lib/services/email.ts`, `booking-documents.ts`, admin booking views and statistics.
- Data: reviewed migration for monetary snapshots, checkout attempts, draft capability binding, owner mapping and appropriately scoped RLS. Preserve existing bookings, age restrictions, capacity constraints, weekday 15–23 / off-peak 15–17 and weekend 09–23 peak hours.

## Proposed configuration (names are a design, not existing settings)

- `CHECKOUT_PROMOTIONS_ENABLED=false` and `CHECKOUT_SIGN_IN_PROMPT_ENABLED=false` initially.
- Server-side IDs mapping approved coupons/promotions separately in test and live environments. No service-specific exclusion for these campaigns: all paid booking types and paid booking add-ons are eligible. No API secrets in NEXT_PUBLIC variables.
- Existing Stripe secret/webhook secret, Supabase configuration and Resend delivery settings remain provider-managed; rotate exposed credentials safely rather than copying them into documentation.
- Explicit policy record for eligibility, redemption limits, expiry/timezone and refunds. Do not use a client-visible discount table as authorization.

## Verification matrix

Cover each eligible resource type and group/masterclass booking, signed-in and guest, each code and no code. Include invalid/expired/exhausted codes, product scope, lower/upper age boundaries, changed sessions, fractional-penny rounding, crossing 5 PM, DST boundaries, invalid duration/closed hours, concurrent bookings, final redemption races, wrong owner, unsafe redirects, failed/cancelled sign-in, expired draft, failed payment, checkout recreation, duplicate/out-of-order webhooks, partial/full refunds and email/PDF reconciliation.

No load tests, real customer cancellations or live payments during the security review. Implementation E2E must use isolated Stripe test objects and synthetic bookings; production smoke tests must be explicitly scoped.

## Release and rollback

1. Add backward-compatible fields and ship verification that supports historical full-price bookings. Test migration/rollback on a non-production copy without customer exports.
2. Resolve security gates and run typecheck, production build, regression tests and dependency audit. Check admin CRUD, booking history, directions links and PDF attachments.
3. Create/validate campaign objects in test mode; obtain approval before live creation. Check hosted promotion eligibility before any customer is charged.
4. Deploy with feature switches off, verify old flow, then activate optional prompt and approved promotions in stages.
5. Monitor checkout success, payment-confirmation mismatches, unauthorized access denials, hold expiry, webhook retry backlog and document delivery using redacted logs.
6. Roll back by disabling promotion creation/UI and prompt independently. Keep discounted-payment verification and monetary snapshots for already-created sessions; do not deploy old full-price-only verification while discounted payments are in flight.
7. Expire unpaid affected sessions safely if necessary; never revoke a paid reservation or silently reinterpret its price. Preserve immutable audit/refund history.

## Definition of done

- All owner decisions recorded and confirmed; both approved codes work for eligible guests and account holders.
- No forced account creation and no loss of booking progress during supported sign-in paths.
- No client-controlled totals or identity, no cross-customer booking access and no ID-only cancellations.
- Actual paid totals reconcile across Stripe, database, admin, email and PDF.
- Webhook replay/expiry and concurrency tests pass for both booking families.
- Security blockers resolved or explicitly risk-accepted by the owner with a documented mitigation; do not describe unresolved critical access control as production-ready.
- Release, rollback and operational support notes are delivered with evidence, not just a passing build.
