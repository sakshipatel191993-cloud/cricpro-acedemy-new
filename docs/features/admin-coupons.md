# Admin-managed coupons

Implemented locally, 2026-09-22. **Not deployed or activated.** This supersedes the earlier proposal to manage provider promotion objects manually in Stripe.

## Admin flow

Open **Admin → Coupons** (`/admin/coupons`). Add a code, percentage (1–99%), maximum uses, start date, exclusive expiry date and status. Dates are midnight **Europe/London**, converted to UTC on the server. Defaults are 50 uses and a 30-day window. COACH15 and COACH20 presets prepare drafts at 15% and 20%; they do not silently create or activate campaigns.

Edit changes future checkouts only. **Disabled** pauses a code so it can be reactivated. **Remove → Confirm removal** archives it permanently; its code cannot be reused, and historical uses and started checkouts remain intact. Use **Show removed coupons** to inspect archived records. Codes cannot be renamed.

Paid redemptions and pending reservations are shown separately. A cap cannot be reduced below committed uses. Version checks prevent one admin tab silently overwriting another's changes.

## Customer flow

- Optional coupon input in resource booking review and group/masterclass registration; no account required. The server previews subtotal, discount and net total, then rechecks eligibility during reservation.
- All currently paid services are included: lane hire, side arm, bowling machine, group sessions and masterclasses, including paid add-ons represented in the authoritative subtotal. Coaching/party enquiries have no payment to discount.
- One code per booking, no stacking, one committed use per normalised booking email across all codes, plus verified account identity where supplied. Guest email limits are a practical control, not proof of one human; no alias stripping or forced sign-in.
- All codes share one customer-use pool in v1. Separate repeat-customer campaigns need a future policy version.
- Reserved uses occupy capacity until verified payment or terminal unpaid expiry/failure. Unknown payment outcomes are not released by timers. Paid uses are not automatically restored after refunds; confirm this conservative default before activation.
- Edits, removal and expiry stop new reservations, not payments already started. Stale previews fail safely. Existing bookings are not retroactively discounted.

## Technical contract

`coupons`, `coupon_redemptions` and `coupon_audit` are service-role-only with RLS and browser-role revocation. Admin handlers enforce authentication, same-origin mutations, bounded JSON and allowlisted fields. Preview uses shared throttling and an owned quote or active session's server price, never a browser price.

The migration wraps resource/group inventory and coupon reservation in one transaction. Campaign and row locks serialize remaining capacity and cross-code customer checks; rejected coupons roll back inventory holds. Snapshots preserve code, percentage, version, original subtotal, reduction and total in integer GBP pence. Booking `amount` remains the **expected amount payable**; historical rows are unchanged.

Discounts are application-owned, **not Stripe Dashboard Coupon/Promotion Code objects**. Stripe receives one server-calculated net-price line item, with original price/code/saving in its description and audit metadata. Unrestricted hosted promotion entry stays off, preventing bypass of the shared ledger and avoiding duplicate campaign configuration. Stripe's native coupon reports will not classify these as provider redemptions; use CricPro's ledger. Do not add automatic tax/extra discounts without revisiting reconciliation. Exact-total GBP/session/payment verification, durable attempts and outbox delivery remain intact.

Breakdowns appear in checkout preview, Stripe item description, customer/admin resource emails, group confirmations, PDF attachments, private booking details/downloads and admin resource booking rows. Account/success pages retain their existing minimal status/net-total display.

## Release requirements

1. Apply the prior security migrations and `20260922145528_admin_managed_coupons.sql` to isolated preview first. Retain security rollout requirements, including timestamp/pricing audit and distributed limiter configuration.
2. Configure a stable random server-only `COUPON_IDENTITY_SECRET` (32+ characters), different per environment. Changing it invalidates email-use correlation; use a reviewed key migration rather than blind rotation.
3. Keep `CHECKOUT_PROMOTIONS_ENABLED=false` until isolated provider tests pass. Admin drafts can be prepared while off. No launch dates or live coupons are seeded.
4. Test Stripe test-mode discounted payments, lost responses, expiry, signed webhooks, receipt downloads and controlled-recipient emails for both booking families. Configure the recovery worker for uncertain attempts.
5. Confirm refund-restoration policy, choose exact UK start/expiry dates, then activate the campaigns and feature flag. No deployment or activation was performed here.

Rollback stops new coupon reservations via the flag but must retain snapshot-aware verification, ledger triggers, rendering and recovery for in-flight payments. Never delete historical redemptions to reset caps.

## Verification

- 39 Node test-runner entries pass: validation/rounding, UK date boundaries, admin authentication/origin/CRUD, isolated database concurrency and existing access/payment regressions.
- Isolated PostgreSQL: migration, RLS/RPC grants, create/edit/archive/audit, all five paid services, resource wrapper rollback, cross-code limits, preserved totals, settlement/release, expiry and stale versions.
- Multi-connection tests: one final-cap redemption, one use across racing codes for the same customer, one redemption for duplicate submissions.
- TypeScript and production build pass. Local browser login/form/presets inspected. The web preview has no provider credentials; browser→Supabase persistence and Stripe/email E2E remain release gates. Handler/direct SQL tests are not provider E2E.
- Isolated Supabase advisors reported only existing public-schema `pgcrypto`/`btree_gist` extension warnings, not coupon-specific findings. [Extension placement guidance](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).

Reference: [Stripe Checkout discounts](https://docs.stripe.com/payments/checkout/discounts); native provider promotions are deliberately not enabled.
