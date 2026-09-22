# Feature: checkout promotion codes

Date: 2026-09-22 | Status: admin management and checkout integration implemented locally; not deployed/activated

Implementation update: [admin-managed coupon flow](admin-coupons.md) supersedes the historical provider-object and admin-out-of-scope proposals below. Coupons are application-owned and Stripe charges the fixed net total; no live campaign is seeded. Remaining rollout/provider checks are recorded there.

## Confirmed requirements

| Customer code | Percentage off | Example: £40 subtotal |
|---|---|---|
| COACH15 | 15% | £6 discount; £34 paid |
| COACH20 | 20% | £8 discount; £32 paid |

Customers enter a code at checkout and see the revised total before payment. Sign-in is encouraged but is not a requirement for using an eligible code. One promotion per checkout; no stacking. Existing bookings and already-paid totals are not changed retroactively.

## Approved initial campaign rules

The owner accepted the recommended general rules. Future changes must be versioned without altering already-paid bookings.

| Rule | Initial policy |
|---|---|
| Codes | COACH15: 15%; COACH20: 20% |
| Eligibility | All paid booking types: lane hire, sidearm, bowling machine, group sessions, masterclasses, and coaching/birthday parties when a paid booking flow exists |
| Validity | 30 days from launch, ending at midnight UK time |
| Campaign caps | 50 successful redemptions per code |
| Customer cap | One successful redemption per customer across both codes |
| Stacking | One promotion per booking; no combining offers |
| Minimum spend | None, subject to provider minimum payable amounts |
| Authentication | Optional; guests eligible |
| Refunds | Existing cancellation policy applies; refund only money actually paid |
| Existing bookings | No retrospective discounts |

The campaign clock starts at live launch, not approval. Publish exact start/end timestamps before activation using Europe/London calendar boundaries and an exclusive UTC expiry instant. No launch date is scheduled. The owner expanded eligibility to all paid booking types, superseding the earlier coaching/group-only restriction. Apply the discount to the complete server-calculated booking subtotal, including paid booking add-ons. Coaching and birthday-party enquiries have no payment to discount; they become eligible when a paid booking flow exists. This policy does not itself add those payment flows.

Guest repeat-use limits use a consistently normalised booking email, with authenticated identity linked where available. Another email can evade this practical control; it is not proof of one human. Do not require sign-in, merge unrelated email aliases or reveal another customer's redemption history.

Refund restoration was not specified in the accepted rules. Proposed operational default: paid redemptions remain consumed after refunds, without automatic cap or eligibility restoration. Confirm this detail before activation. Failed/abandoned unpaid checkouts do not count as successful redemptions.

Use a shared campaign redemption ledger for both codes. Atomically reserve customer eligibility and remaining code capacity before creating payable checkout, settle once on verified payment, and release only when an unpaid attempt can no longer settle. Replays and concurrent checkouts must not bypass limits. Stripe coupon duration and independent per-code caps alone do not enforce the cross-code customer rule.

Activation remains off pending implementation, security gates, exact launch timestamps and the refund-restoration decision. Approval is not evidence of live Stripe configuration.

## Pre-implementation baseline (historical)

- `apps/web/lib/services/stripe.ts` creates hosted, one-time GBP Checkout Sessions using inline product data. Promotion entry is not enabled.
- Both `confirm-booking.ts` and `confirm-group-booking.ts` compare paid total to the original booking amount. Merely enabling promotions would cause legitimate discounted payments to fail fulfilment.
- Resource bookings and group bookings have separate storage and confirmation paths; both must be updated.
- Current multi-slot review creates multiple checkouts but redirects to only the first. Resolve this before claiming basket-wide discount support: either one atomic order/checkout for all slots or explicitly constrain the supported UI to one payable booking per checkout.
- Current hourly pricing uses the starting hour for the whole duration. Calculate the server quote across all rate boundaries using venue time before adding discounts.

## Historical proposed checkout integration (superseded)

Use an application-owned code field with server validation and an explicitly attached Stripe promotion for the approved shared-limit policy. Disable unrestricted hosted promotion entry so a customer cannot switch to an unreserved code. Stripe-hosted entry was the initial alternative and requires equivalent reservation guarantees before reconsideration. Create separate test and live objects; never copy test IDs into live configuration. Manage provider campaign objects through Stripe Dashboard in v1, coordinated with the versioned application policy/ledger; a CricPro coupon-management screen is out of scope.

Scope matters: enabling promotion entry is not a per-session allowlist of only these two strings. Review all active Stripe codes and product eligibility. If service-specific restrictions are approved, introduce stable Stripe Product IDs for the relevant services rather than a new inline product for every booking. If exact per-session code allowlisting cannot be enforced in hosted Checkout, use an application-owned code input with server validation and pass the approved promotion into Stripe instead. Do not charge an ineligible discounted payment and discover the restriction only during fulfilment.

Stripe handles code validity/expiry/redemption constraints supported by its API. The application must still authorize the booking, calculate its base quote, restrict the permitted campaign and validate payment. Never accept a percentage, subtotal, discount or final amount supplied by the browser as authoritative.

## Proposed data contract (requires reviewed migrations)

Use integer GBP pence for new monetary fields and a versioned quote snapshot. Preserve historical `amount` semantics until every reader/report has migrated.

| Field | Purpose |
|---|---|
| quote_version / quote_expires_at | Detect stale quote and policy changes |
| subtotal_minor | Immutable server-calculated original total |
| discount_minor | Verified reduction, zero without promotion |
| total_minor / paid_minor / currency | Expected final total and actual Stripe payment |
| promotion_code_id / coupon_id / code_snapshot | Provider identity plus human-readable audit history |
| stripe_session_id / payment_intent_id | Exact checkout/payment binding and refund lookup |
| user_id or guest capability binding | Authorized owner, independently of billing email |

Store eligibility/campaign version with checkout attempts. Use unique keys for Stripe event IDs and settled attempts; no secrets or card data in records. Make all fields backward-compatible with historical full-price bookings and existing PDF generation. Tax/shipping are not introduced by this feature; if configured later, reconcile their trusted components explicitly.

## Payment lifecycle

1. Validate requested session age, capacity, slots, duration and active resource; calculate a fresh server quote.
2. Authorize the customer's draft/booking, reserve capacity atomically and create one idempotent checkout attempt with the approved promotion policy.
3. Customer applies a code in the chosen checkout UI; Stripe displays the new total.
4. Signed webhook or server-retrieved success fallback verifies paid status, GBP, mode/livemode, exact session/booking binding, subtotal matching the immutable quote, permitted discount and final arithmetic. Never replace equality checks with “paid amount <= booking amount.”
5. Persist the discount snapshot and paid transition atomically. Only the successful transition enqueues confirmation/receipt delivery. Notification retries must not repeat fulfilment or redemption accounting.
6. Expiry/failure releases only that unpaid attempt's hold. An old checkout event must not cancel a newer or already-paid booking.

## Customer/admin output

Show original price, code, percentage, discount and final paid total consistently in the Stripe checkout, success page, account history, admin booking details, customer/admin emails and payment receipt PDF. Keep booking confirmation PDF, directions links and existing sender/reply routing. Guest and signed-in customers receive the same documents. Do not email unpaid holds as confirmed bookings.

## Acceptance tests

- Both codes produce the correct totals; test £40 examples plus fractional-penny rounding and low-value totals against Stripe's result.
- Verify both codes across lane hire, sidearm, bowling machine, group sessions and masterclasses, including paid add-ons. Shared customer limits span all booking types, not one use per service. Cover future coaching/party payment flows when introduced.
- No code leaves full-price flow unchanged; invalid/expired/exhausted/ineligible codes never reduce payment.
- Guest and authenticated customers can redeem equally under the approved campaign rules; no sign-in wall.
- An unrelated active Stripe promotion cannot bypass approved product/campaign scope.
- Manipulated prices/user IDs/session IDs, wrong currency, stale quotes and arbitrary lower payments fail safely.
- Duplicate callbacks, concurrent final redemptions, retries, removed codes, abandoned checkout, payment failure and refund handling preserve consistent state.
- Eligible group/masterclass ages and capacity remain enforced; multi-slot totals are not represented as paid when only one slot was charged.
- Confirmation, admin view and PDF totals reconcile with Stripe. Existing undiscounted bookings still verify correctly.

## References

- [Stripe Checkout Session creation](https://docs.stripe.com/api/checkout/sessions/create)
- [Stripe discounts](https://docs.stripe.com/payments/checkout/discounts)

Implementation must verify the installed Stripe SDK/API version before using specific promotion-code object fields.
