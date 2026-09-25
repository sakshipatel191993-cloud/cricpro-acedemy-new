# Block bookings

Lane-hire blocks repeat the same lane, local UK start time and duration on selected
weekdays for at most four calendar months. Every occurrence uses the authoritative
single-session pricing engine. For blocks lasting at least six weeks, Saturday and
Sunday sessions priced at £25 per hour are reduced to £22.50 per hour. The discount
is calculated and stored in the server-side quote, so the Stripe total and the
session receipts use the same amount. Coupon redemption and Stripe promotion-code
entry do not apply to block bookings.

Apply `supabase/migrations/20260924133000_block_booking_foundation.sql` after the
existing quote and checkout-recovery migrations before deploying the application.
The existing authoritative-quote, timezone, hourly-price, payment and guest-access
rollout settings still apply. No live migration or Stripe charge is part of local tests.

`POST /api/block-bookings/quote` returns the persisted quote, dates, occurrence prices
and expiry, and sets an HTTP-only capability cookie. `POST /api/block-bookings` accepts
that quote ID and customer details. It rejects coupon/discount fields, reserves all
sessions in one database transaction and saves a recoverable checkout attempt before
contacting Stripe. A conflict or configuration change rolls back the entire block.

The signed Stripe webhook, success-page verifier and existing payment-recovery worker
confirm the block idempotently. Confirmation queues ordinary per-session emails and
receipts, each allocated only that session's price. Verified expiry releases every
session together. Unknown provider outcomes retain inventory for reconciliation.
Timer cleanup and individual admin status/deletion actions exclude block sessions.
Admin calendars continue to show the ordinary booking rows with `block_booking_id`.

Guest verification uses the first session's access scope to show the block summary.
Each session's confirmation email provides its private document access. A block
receipt download verifies the parent Stripe payment before allocating the session
amount. Existing signed-in access is provisioned for the first session.

Validation:

- `node --test apps/web/tests/block-bookings.cjs apps/web/lib/booking-quote.test.cjs`
- `node apps/web/tests/checkout-recovery.cjs`
- `node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json`
- Run `apps/web/tests/block-bookings-db.sql` in a disposable PostgreSQL database
  after the bootstrap and required migrations; it rolls back its fixtures.
- `apps/web/tests/block-bookings-concurrency.cjs` requires an isolated fixture on
  localhost port 55449 and `ALLOW_ISOLATED_PG_TEST=true`. It creates synthetic data
  in that disposable database. Never run these database tests against production.
