# Local development and feature branches

Use the original repository for ongoing work:

`C:/Users/DELL/Documents/Codex/cricpro-acedemy-new`

The app is in `apps/web`. Its existing, ignored `apps/web/.env.local` contains
the provider configuration. Do not copy secrets into Git, remove this file when
switching branches, or launch another checkout without checking its environment.

## All feature branches merged on 23 September 2026

`feature/local-review` now includes every feature branch below, including the
security/coupon and WhatsApp histories. See [the integration report](integration-review-2026-09-23.md)
for current verification, rollout gates and previously planned features that are
not implemented. The merge is local only; it is **not ready to deploy unchanged
against the existing database/configuration**.

| Branch | Scope | Readiness |
| --- | --- | --- |
| `feature/local-review` | All five feature branches, with resolved checkout/notification integration | Build/tests pass; local UI available, checkout activation gated |
| `feature/email-notifications` | Enquiry emails, branded notifications and booking/payment PDFs | Existing feature history, imported without rewriting it |
| `feature/coaching-hours` | Coaching directory, opening hours, footer/maps and session-age rules | Existing feature history, imported without rewriting it |
| `feature/whatsapp-notifications` | WhatsApp onboarding, consent, dispatch and recovery preparation | Requires provider onboarding/settings before real sending |
| `feature/secure-checkout` | Auth, shared rate limits, guest access, authoritative quotes, durable payments and customer coupon/reservation foundations | Requires the reviewed database migrations, configuration and rollout checks |
| `feature/admin-coupons` | Admin coupon creation/editing/removal, protected management API, navigation, tests and feature documentation | Stacked on `feature/secure-checkout`; same migration/configuration gates apply |
| `backup/original-before-feature-consolidation` | Exact non-secret original-project changes before consolidation | Recovery checkpoint; do not merge as a new feature |

`feature/secure-checkout` is based on `feature/coaching-hours`.
`feature/admin-coupons` is based on `feature/secure-checkout`, not on `main`.
Shared reservation/discount infrastructure is intentionally in the prerequisite
branch; the child branch adds the administrator-facing coupon management flow.
The individual checkout branches retain their original tips. Their combined
integration, including WhatsApp consent and paid notification dispatch, is on
`feature/local-review`. Do not force-reset that branch to an individual feature tip.

The complete checkout/coupon implementation was imported byte-for-byte from the
previous local work, excluding generated Next.js agent/type files and Supabase
CLI cache. The previous working copy remains untouched for recovery, but is not
the directory to use for future development. These are local branches only;
nothing was pushed, deployed or migrated as part of consolidation.

## Run and switch safely

1. Stop the dev server before switching branches.
2. From the original repository, use `git switch <feature-branch>`.
3. Run `npm install` if the branch changes `package-lock.json`. In particular,
   secure checkout currently upgrades Next.js beyond the local-review version.
4. Confirm `apps/web/.env.local` is present without printing its values.
5. Start the app with `npm run dev --workspace=web -- --hostname 127.0.0.1 --port 3000`.
6. Open `http://localhost:3000` and verify the relevant API and UI.

The current configured Supabase project is the existing shared project, not an
isolated local database. Stripe is in test mode, but database writes and emails
can still affect real records/recipients. Verification during consolidation used
read-only data checks and a local admin sign-in, not a booking or email send.

Do not enable the new checkout flags merely to remove a 503 response. The new
booking columns, access/recovery schema and coupons migration must first be
reviewed/applied to the intended database, and historical time/price conventions
must pass the documented rollout audit. Keys alone do not perform migrations.

## Historical verification before the security/coupon merge (22 September)

These results describe the earlier checkout implementation, not the current
merged checkout. The current slot endpoint intentionally returns 503 until the
new schema/configuration and timestamp/price audit are ready.

- Four lane tabs render in the browser.
- Selecting 23 September 2026 loads eight Lane 1 slots, 15:00 through 22:00.
- Lane 1 prices show GBP 15 at 15:00/16:00 and GBP 25 from 17:00.
- Admin sign-in, bookings, resources and enquiries return HTTP 200.
- No captured browser console errors on the lane page.
- TypeScript passes; 21 coaching/hours/WhatsApp Node test entries pass, and the
  session-age assertion script exits successfully.
- Existing `.env.local` was not modified; database schema/data were not changed.
