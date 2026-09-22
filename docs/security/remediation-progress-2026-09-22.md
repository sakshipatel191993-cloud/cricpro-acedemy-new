# Security remediation progress — 2026-09-22

Status: first parallel remediation batch implemented and tested locally. **Not deployed.** Keep detailed security documents private until reviewed for publication. The original assessment remains a historical baseline, not the status of these local changes.

Update: phase two is now also implemented locally. The first-batch observations below are historical; see [current implementation status](phase-two-implementation-status.md), including shared rate limiting, scoped guest access, authoritative quotes and durable recovery. Production protection remains unchanged until rollout.

## Implemented

- Public booking lists require a verified Supabase bearer identity or a valid admin session. Customer queries are restricted to their stored `user_id` and return a reduced field set with no-store caching; email filters do not authorise access.
- Public enquiry retrieval is admin-only.
- Unsafe ID-only cancellation and checkout recreation endpoints return HTTP 410 without database or Stripe mutations. Cancellation instructions point to support; no record is falsely marked refunded.
- Account history uses the authenticated API. Guest/legacy bookings lacking secure ownership links are deliberately excluded and the UI explains this limitation. New resource bookings still require a separate secure owner-linking implementation; do not promise complete account history yet.
- Admin authentication fails closed on missing/weak/default configuration, verifies passwords and signed sessions securely, rejects future/expired tokens, adds process-local throttling and requires same-origin admin mutations. Login/signup return paths reject unsafe destinations.
- Resource checkout uses a stable booking-specific Stripe idempotency key and persisted expiry. Failure/expiry events must match the currently stored Stripe session and pending booking status.
- Browser headers add anti-framing, nosniff, restricted permissions, referrer policy and a limited CSP for frame ancestors, objects and base URLs. This is not a complete script-src/nonce CSP rollout.
- Next.js pinned to 16.3.5; vulnerable transitive packages updated within allowed ranges and lockfile regenerated. Removed the obsolete `turbopackUseSystemTlsCerts` option, which the upgraded version no longer recognises.

## Verification

- 17 Node test-runner entries pass across access, authentication, payment security, existing session payment/age/scheduling/selection, email, coaching/hours and headers. Database/provider interactions in these tests are mocked; no real payment, cancellation or customer-data retrieval was used.
- TypeScript `--noEmit` passes.
- Next.js production build passes (49 static pages generated). Initial restricted-network attempt could not download existing Google Fonts; the network-authorised retry passed. Middleware naming deprecation remains a non-blocking warning.
- Dependency install/update audit reports **0 known vulnerabilities** after targeted updates. This does not certify the application has no security flaws.
- `git diff --check` passes. Existing PRD, coupon-policy and Taste skill changes are preserved separately in the worktree.

## Deployment gates and outstanding work

The next three workstreams were specified in the [phase-two implementation plan](phase-two-implementation-plan.md) and have now been implemented locally; deployment/configuration gates remain.

1. Rotate previously shared provider/server credentials. Admin password must be at least 12 characters and not a known starter value; signing secret must be random and at least 32 characters. See [admin-auth notes](admin-auth-hardening.md). Verify environment values securely before deployment to avoid an intentional fail-closed admin lockout. No credential was read, rotated or changed here.
2. Review these changes and run preview/browser smoke tests with synthetic accounts before production. Verify same-origin behaviour behind the deployment proxy, customer/admin login, guest checkout, headers and notification delivery. No deployment was performed.
3. Add distributed throttling or trusted WAF protection; the process-local limiter is only a first layer. Individual administrator identities, MFA and per-session revocation remain outstanding.
4. Finish server-side resource/service/time validation, Europe/London rate-boundary pricing, multi-slot checkout consistency, and robust handling of checkout-session persistence failures. These risks are not solved by the idempotency patch.
5. Add secure customer/guest booking ownership, legacy linking, and authorised cancellation with verified refund processing. Do not restore ID-only or email-only access as a compatibility workaround.
6. Review Supabase password protection and extension placement, comprehensive CSP, monitoring, backup recovery and historical-access evidence separately.

Coupon policy now covers all paid booking types, but coupon implementation and activation remain pending. Do not describe this first batch as full security completion or production protection until the approved changes are deployed and remaining risks are addressed.
