# Feature: optional sign-in before checkout

Date: 2026-09-22 | Status: proposed; not implemented

## Goal and non-negotiables

Encourage account use without adding a barrier to booking or discounts. Display a compact pre-payment panel:

> Sign in to keep track of your bookings.
> Sign in · Create account · Continue as guest

Show the booking-history benefit only after secure history works. Continue as guest must remain obvious, accessible and usable without dismissing repeated prompts. Do not automatically create accounts, preselect marketing consent, require sign-in for a coupon, or interrupt already-signed-in customers.

## Placement

- Resource bookings: review stage before opening Stripe Checkout.
- Group sessions/masterclasses: after selecting the session and before payment submission.
- Existing signed-in customer: show account identity and allow editing booking/contact details; no redundant prompt.
- Stripe payment is separate from CricPro authentication; do not attempt to insert a Supabase sign-in form into Stripe's hosted page.

## Draft continuity and authentication

Recommended design: persist a minimal, short-lived server booking draft before navigating to login, bound to a high-entropy guest capability in a Secure, HttpOnly, SameSite cookie. The return URL carries only an opaque draft identifier and an allowlisted internal destination, never names, email, phone, medical notes, passwords or tokens. Proposed draft lifetime: 30 minutes, subject to product approval and existing capacity-hold timing.

Keep ordinary navigation drafts distinct from capacity reservations. Signing in does not extend a hold or guarantee an old price. On return, revalidate age, availability and price, and explain any changes before payment. Preserve an entered promotion intent if the UI supports one, but revalidate it with the current campaign. In the default flow the promotion is entered on Stripe after sign-in, so it has not yet been applied during the sign-in detour.

Support login failure, cancellation, browser Back and signup requiring email verification. All must retain a guest path. Same-tab draft continuation is required; cross-device continuation requires an explicit secure recovery design and must not rely on sessionStorage alone. Never store auth tokens or medical details in a return URL. Delete expired/completed drafts under a documented retention policy.

## Secure ownership and booking history

- Verify the Supabase identity on the server; never trust `user_id` from JSON, user metadata roles, or a supplied customer email.
- Link newly created paid bookings to the verified owner while keeping guest bookings valid with a null owner.
- Existing `bookings.user_id` references `public.users`; review provisioning/mapping to `auth.users` before writing it. Group bookings need corresponding ownership support.
- Use least-privilege RLS or an owner-scoped server API to expose a minimal history for both resource and group bookings. Current direct browser history queries cannot work correctly against tables with RLS but no select policies.
- Claiming an old guest booking requires verified proof of access to that booking/mailbox; typing its email address is insufficient. Do not silently attach all historical bookings based on a contact field.
- Guest view/cancel/resume actions require scoped, expiring capability tokens, stored hashed where appropriate; a public booking reference or booking ID is not authorization.
- Separate cancellation from refunds; apply policy and record a successful provider refund before showing “refunded.”

## Redirect safety

Replace direct `router.push(from)` in login/signup with a shared allowlisted internal return-target validator. Reject external/protocol-relative URLs, executable schemes, backslashes, encoded bypasses and malformed values; fall back to a safe page. Bind draft access to the browser/customer, not just the return path. Revalidate identity after login and support secure sign-out/session expiry.

## Acceptance tests

1. Guest can book, apply either eligible promotion and receive email/PDF without registration.
2. Successful login returns to the same draft with session/slot, player/contact fields and eligible promotion intent intact.
3. Cancelled/failed login or unverified signup still permits guest continuation without losing safe draft data.
4. Existing signed-in users see no prompt and see only their own completed bookings.
5. Changing session clears ineligible ages; expired holds or changed prices require a new confirmed quote.
6. Customer A cannot access/claim/cancel customer B's draft or booking; supplying B's email or ID has no effect.
7. Unsafe return URLs are rejected; no personal data is included in navigation URLs or analytics.
8. Mobile 375px/390px, keyboard navigation, labels, focus restoration and 44px touch targets work.
9. Guest and authenticated bookings retain identical payment verification and receipt behaviour.

Measure guest/signed-in completion, prompt-to-sign-in conversion, sign-in abandonment and draft-resume failures using aggregate events without contact details or sensitive query parameters. No new analytics service is installed as part of planning.

Reference: [Next.js useRouter security guidance](https://nextjs.org/docs/app/api-reference/functions/use-router).
