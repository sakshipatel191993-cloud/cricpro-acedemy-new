# Block booking production rollout

This rollout covers block lane bookings and the related fixes validated locally:
shared physical-lane inventory, authoritative single-session pricing, weekend block
discounts, short booking references, payment recovery, summary email data, coupon
scope, future-only group/masterclass listings, and lane/mode form resets.

## Release gates

- [x] TypeScript passes.
- [x] The full application test suite passes (34 tests).
- [x] A clean Next.js production build succeeds.
- [x] The feature works locally with Stripe test checkout and Supabase.
- [ ] Commit the complete working tree on `feature/block-bookings` and review the
      resulting diff. The feature currently includes modified and untracked files.
- [ ] Run the SQL and concurrency suites against a disposable staging PostgreSQL
      database. Never point these tests at production.
- [ ] Confirm the production Supabase project and take a restorable backup.
- [ ] Confirm all production environment values without copying local development
      URLs, test Stripe keys, or the local rate-limit fallback.
- [ ] Create and test a preview deployment before promoting the same artifact.

## Production configuration

Set these values in the production deployment environment and verify their scope:

- `NEXT_PUBLIC_APP_URL=https://<production-domain>` with no localhost value.
- Production Supabase URL, public/anon key, and server-only service-role key.
- `PAYMENTS_ENABLED=true`, Stripe live publishable/secret keys, and the signing
  secret for `https://<production-domain>/api/webhooks/stripe`.
- Subscribe the Stripe webhook to `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`, `checkout.session.expired`,
  `checkout.session.async_payment_failed`, and `charge.refunded`.
- `RESEND_API_KEY`, verified `EMAIL_FROM`, and `ADMIN_EMAIL`.
- `AUTHORITATIVE_QUOTES_ENABLED=true`, `BOOKING_TIMEZONE_VERIFIED=true`, and
  `BOOKING_PRICE_UNITS=hourly`.
- `GUEST_BOOKING_ACCESS_ENABLED=true` and `CHECKOUT_PROMOTIONS_ENABLED=true` if
  those existing production features are intended to remain enabled.
- Production Upstash Redis URL/token, a 32+ character `RATE_LIMIT_KEY_SECRET`, and
  a production-only `RATE_LIMIT_NAMESPACE`. Keep `RATE_LIMIT_LOCAL_FALLBACK=false`.
- A 32+ character `CRON_SECRET`; confirm the Vercel daily payment-recovery cron can
  authenticate to `/api/internal/payment-recovery`.
- Keep WhatsApp flags at their existing production values. This rollout does not
  require enabling WhatsApp.

## Database rollout

Apply the migrations before deploying the application, in this order:

1. `20260924133000_block_booking_foundation.sql`
2. `20260924194500_block_booking_email_summary.sql`
3. `20260924195500_short_booking_references.sql`
4. `20260925100000_shared_lane_inventory.sql`

Before applying them, confirm all earlier quote, checkout recovery, guest access,
coupon, and notification migrations are present. After applying them:

- Confirm `block_bookings` and `block_booking_quotes` have RLS enabled and remain
  accessible only to `service_role`.
- Confirm the reservation, confirmation, expiry, notification-claim, and short
  reference functions exist and execute only for `service_role`.
- Confirm `checkout_attempts` accepts exactly one resource, group, or block target.
- Confirm the availability-rule trigger accepts physical lanes and rejects
  side-arm or bowling-machine service resources.
- Create a staging block quote and verify all occurrences reserve atomically.

The schema changes are additive and should remain in place if the application is
rolled back. The destructive emergency script in
`docs/block-booking-foundation-rollback.sql` deletes block data and must only be
used after explicitly confirming there are no customer block bookings to retain.

## Preview acceptance test

Use a preview deployment connected to a staging database and Stripe test mode.

1. Verify weekdays show 3:00 PM onward and weekends show 9:00 AM onward, in
   12-hour format, with the same prices as single lane hire.
2. Switch lanes and switch between single/block modes. Dates, schedules, slots,
   totals, notes, duration, and player count must reset; customer contact details
   may remain populated.
3. Verify repeat-until cannot exceed four calendar months and the session count
   and total appear before confirmation.
4. Verify a block under six weeks has no discount. Verify a block of at least six
   weeks prices eligible weekend hours at £22.50 and displays £25 struck through.
5. Complete one single lane payment and one mixed-weekday block payment. Confirm
   the success page, database rows, `CCOE-XXXXXX` reference, customer/admin email,
   PDF/receipt totals, and private booking access.
6. Attempt a conflicting side-arm or bowling-machine booking for the same physical
   lane and time. It must be unavailable across all four booking paths.
7. Confirm coupons appear only for ordinary lane hire and remain unavailable for
   block, side-arm, bowling-machine, group-session, and masterclass checkout.
8. Confirm past group sessions and masterclasses are absent.
9. Replay Stripe completion and retry payment verification. Confirmation and email
   delivery must remain idempotent.
10. Let or force an unpaid staging checkout to expire and confirm every occurrence
    is released together.

## Release and monitoring

1. Freeze booking-related changes and record the current production deployment ID.
2. Apply and verify the production database migrations.
3. Deploy the reviewed commit as a preview using production configuration, without
   changing the production alias.
4. Run read-only page/API checks against the preview. Use Stripe test mode only on
   staging; do not create a test charge in the live account.
5. Promote the already-tested preview artifact to production.
6. Immediately repeat the non-payment checks on the production domain, then perform
   one controlled low-value live booking if the business owner approves the charge.
7. Monitor Vercel function errors, Stripe webhook delivery, Supabase errors,
   checkout attempts, notification outbox state, and Resend delivery for at least
   one complete booking and the next recovery-cron run.

## Rollback

- If application behavior is wrong before any payment, restore the previous Vercel
  production deployment. Leave the additive database schema installed.
- If Stripe callbacks fail, keep the new database schema, restore the previous app,
  retain pending inventory, and reconcile checkout attempts from Stripe before
  releasing any booking.
- Do not run the destructive SQL rollback after a real block booking exists. Fix
  forward or migrate customer data deliberately.

