# Feature integration review — 23 September 2026

## Scope and result

All five feature branches are integrated into `feature/local-review` in the
original repository. Branches/history remain intact. Recovery points:
`backup/before-all-features-20260922` and
`backup/original-before-feature-consolidation`.

| Feature branch | Preserved implementation |
| --- | --- |
| `feature/email-notifications` | Branded enquiry/customer/admin emails, noreply sender defaults, map links, booking PDF and verified payment receipt |
| `feature/coaching-hours` | Live database coach directory, optional coach choice, footer, admin-defined session ages, weekdays 15–23/off-peak 15–17, weekends 09–23/all peak |
| `feature/whatsapp-notifications` | Customer opt-in, durable job queue, post-confirmation dispatch, signed delivery/STOP webhook, guarded worker and local-only demo |
| `feature/secure-checkout` | Admin/owner access, shared rate limits, guest capabilities, authoritative prices, idempotent payment recovery, notification outbox, customer coupons |
| `feature/admin-coupons` | Protected coupon creation/edit/disable/archive, ledger, presets and admin navigation |

## Integration repairs

- Kept the new server quote/payment security path, without restoring insecure
  legacy price, cancellation or immediate unpaid confirmation code.
- Resource and group coupon transactions now retain server-stamped WhatsApp
  consent. Group request fingerprints include the opt-in choice, not its changing
  server timestamp. Retries preserve the original recorded consent.
- Payment confirmation commits email jobs and the WhatsApp trigger together.
  Removed legacy direct email sends so the durable outbox owns retries.
  Payment-success fallback now dispatches the outbox as well as the webhook.
- Preserved private response cache headers and both coupon/WhatsApp checkout UI.
- Added missing security, Redis, coupon and scheduler names to Turbo's environment
  allowlist; `.env.local` was not edited and its SHA-256 remained unchanged.
- Availability errors now render separately from an empty slot list on lane,
  bowling-machine and side-arm pages.
- Installed the merged lockfile, including Next.js 16.3.5, and retained its
  generated agent/type guidance files.

## Verification

- 61 Node test entries passed with zero failures/skips, including opt-in isolated
  PostgreSQL quote, coupon, guest-token and payment-outbox concurrency checks.
- TypeScript and Next.js production build passed; 62 generated pages. The
  middleware-to-proxy naming deprecation remains a non-blocking warning.
- Rehearsed the base schema, three prior session migrations and all six feature
  migrations in order in a fresh disposable PostgreSQL database. Five SQL suites
  passed: combined notifications, coupons, guest access, payment recovery, quotes.
- Combined SQL test proves discounted resource/group bookings retain consent,
  queue nothing before payment, redeem coupons on payment, and queue exactly one
  WhatsApp job plus the expected email jobs after repeated confirmation.
- Provider transports are mocked in regression tests. No real checkout, email,
  WhatsApp message or shared-database write was performed.
- Local browser: homepage renders without captured console errors; latest hours,
  live coaching message, footer/maps and four lane buttons are visible. Supabase
  resource reads return 200. Slot request returns the expected rollout-gate 503.
  Verification stopped at that boundary; full provider/browser checkout is pending.

## Required before checkout activation or production deployment

1. Review/apply the five 22 September migrations to an isolated Supabase preview
   first, then the intended shared database with approval. Confirm the earlier
   WhatsApp/session migrations and existing migration history; do not blindly
   rerun already-applied files. This merge adjusted the **unreleased** quote and
   coupon migrations to preserve consent; an environment that already applied
   older copies needs a reviewed forward-only function update.
2. Read-only checks of the current configured shared project found missing
   `bookings.pricing_resource_id`; REST also returned schema-cache-not-found for
   `booking_quotes`, `coupons`, `booking_access_scopes` and `checkout_attempts`.
   This is not a missing Supabase key: `resources` returned 200.
3. Complete the historical timezone and admin pricing audit before enabling
   `AUTHORITATIVE_QUOTES_ENABLED`, `BOOKING_TIMEZONE_VERIFIED` and setting
   `BOOKING_PRICE_UNITS=hourly`. Enable guest access after its schema is verified.
4. Configure production Redis REST credentials, `RATE_LIMIT_KEY_SECRET`, distinct
   `RATE_LIMIT_NAMESPACE`, stable `COUPON_IDENTITY_SECRET`, and `CRON_SECRET`.
   These were missing locally. Dev-only rate-limit fallback is process-scoped;
   it does not relax production safeguards. Rotate previously shared secrets and
   ensure admin credentials pass the strengthened checks. The current local admin
   password is a known default rejected by the new guard, so admin sign-in also
   requires a credential update before review; no credentials were changed here.
5. Configure authenticated payment recovery and timely WhatsApp recovery schedules,
   monitoring and operational ownership. Rehearse test-mode Stripe payments,
   webhook replay, customer/admin email/PDF receipt delivery and guest recovery.
6. Prepare and activate coupon records with approved dates/limits, then enable
   `CHECKOUT_PROMOTIONS_ENABLED`. COACH15/COACH20 are presets, not seeded campaigns.
   The coupon field belongs in CricPro's pre-payment review/session form, **not**
   Stripe's hosted checkout. It remains hidden while the flag is off.
7. Meta account/number onboarding, approved templates, webhook registration and
   controlled-recipient tests are still required for real customer WhatsApp sends.

## Planned work not present in any merged branch

- Optional checkout sign-in encouragement and secure draft continuity are still
  a proposal. Existing sign-in and guest booking are preserved; the dedicated
  pre-payment sign-in panel is not implemented.
- Admin WhatsApp templates/transport configuration exist, but the durable admin
  event queue/worker is not implemented. It also needs a different recipient
  number and consent; the business sender cannot message itself.
- The wider security backlog (individual admin accounts/MFA, stronger CSP,
  operational monitoring/retention, authorised self-service refunds) is not
  completed by a branch merge. Refer to the security review for scope.

Nothing was pushed, deployed, activated or migrated in the shared Supabase project.
Local UI remains available at http://localhost:3000; booking/coupon activation is
intentionally gated. Existing Stripe tabs represent old checkout sessions and
will not gain a coupon field after this merge.
