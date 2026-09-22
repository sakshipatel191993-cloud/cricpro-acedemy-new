# CricPro security review — 22 September 2026

**Private owner/developer report. Do not publish detailed findings in a public repository or PR before remediation.**

## Outcome and scope

Subsequent local remediation is tracked in [remediation progress](remediation-progress-2026-09-22.md). This assessment below describes the original baseline; fixes are not live until deployed.

The reviewed application should **not currently be described as production-secure**. The highest-priority findings are missing access checks around privileged booking and enquiry operations. Address these before introducing discounts or promoting account booking-history features.

Baseline: release worktree commit `7d9ef86`; production origin inspected: `https://cricprocoe.com`. This was a limited, read-only assessment of source, production response headers, narrowly filtered public API responses, dependency audit, and Supabase security/catalog metadata. Deployment-to-source equivalence was not independently re-established for every route.

No customer records were intentionally retrieved, no booking was created or cancelled, no credential guessing, malicious payload, load test, refund, or exploit was performed. No configuration or production data was changed. Findings do not establish that a compromise has occurred; this review is not a penetration-test certification.

## Prioritised findings

### S01 — Critical: public booking listing and ID-only cancellation

**Evidence:** `apps/web/app/api/bookings/route.ts`, GET around line 30 and DELETE around line 311. GET uses the service-role client to select complete booking rows without authentication. Filters are optional. DELETE accepts a booking ID, with an optional email filter, but does not verify an authenticated owner or a scoped guest capability. It can mark the record cancelled and its payment status refunded without initiating a Stripe refund. Middleware protects admin paths, not this public route.

**Safe live observation:** a GET filtered to a deliberately nonexistent `example.invalid` email returned HTTP 200, success, and zero records without authentication. The admin bookings endpoint returned HTTP 401. No unfiltered list or cancellation request was sent. The code establishes the missing authorisation; the probe does not demonstrate retrieval of actual customer records.

**Risk:** disclosure of personal/booking details, unauthorised cancellation, and misleading financial records. Database RLS does not protect a request executed with the service-role client.

**Required remediation:** remove public listing or require verified identity and ownership with minimal response fields. Use separate, scoped, expiring guest capabilities where necessary; neither an email address nor a booking ID is authorisation. Protect cancellation with ownership, policy checks, audit events, and verified refund processing. Consider immediate containment of these endpoints with owner approval.

### S02 — Critical: public enquiry listing lacks an access check

**Evidence:** `apps/web/app/api/inquiries/route.ts` GET selects complete enquiry rows using the service-role client without authentication. Rows can include names, email addresses, phone numbers and messages.

**Live-test limit:** a request with a deliberately nonmatching type returned HTTP 500. No broad listing was requested. Missing protection is confirmed in source; disclosure of live enquiry rows was not tested or demonstrated.

**Required remediation:** make enquiry retrieval admin-only with server-side authorisation and minimal fields. Public submission must not imply permission to list submissions. Add regression tests for unauthenticated and non-admin requests.

### S03 — High: untrusted sign-in and sign-up return targets

**Evidence:** `apps/web/app/login/page.tsx` and `apps/web/app/signup/page.tsx` take the `from` query value and pass it to `router.push` following authentication without validation.

**Risk:** attacker-controlled navigation, including unsafe URL schemes. Next.js explicitly warns against passing untrusted values to this API. No live exploit or login was attempted.

**Required remediation:** accept only allowlisted same-origin application paths, reject external and ambiguous/encoded targets, and use a safe fallback. The checkout continuity design should use an opaque draft ID bound to the browser rather than arbitrary return URLs. [Next.js useRouter security guidance](https://nextjs.org/docs/app/api-reference/functions/use-router).

### S04 — High: admin authentication hardening gaps

**Evidence:** `apps/web/app/api/admin/auth/route.ts` and `apps/web/middleware.ts` contain known fallback values for the admin password/signing secret. Login has no application-level rate limiter; the shared-password, timestamp-token design has no individual administrator identity or per-session revocation. Timestamp validation does not reject future timestamps, although producing a valid signature still requires the signing secret.

**Limit:** production secret values were not inspected and fallback use is not established. Existing cookies have positive controls: HttpOnly, Secure in production, SameSite=Lax, and a bounded lifetime.

**Required remediation:** fail closed when secrets are missing; rotate exposed credentials; add distributed brute-force controls, revocable sessions, individual admin roles and MFA. Enforce authorisation inside sensitive handlers as well as middleware.

### S05 — High: credentials previously shared in conversation need rotation

Earlier setup messages included server-side credentials for database/Supabase, email, Stripe test/webhook configuration and admin authentication. Treat these as exposed and rotate/revoke them through their respective providers; active status and past rotation were not verified. Never copy their values into documentation, logs or commits. A Supabase public/anon key is intentionally public and is distinct from a service-role key.

Tracked-file inspection found environment examples rather than real environment files, and ignore rules exclude environment secrets. This is **not** a full Git-history or deployed-bundle secret scan. No credentials were rotated during this review.

### S06 — Critical dependency advisory: outdated Next.js and other packages

Read-only `npm audit --omit=dev --json --ignore-scripts` reported **16 affected packages: 1 critical, 9 high, 3 moderate and 3 low**. The direct Next.js dependency is `16.1.6`; audit suggested `16.3.5` as the available remediation target at review time.

The official Next.js advisory for AVIF image optimisation/libheif reports affected versions below `16.3.3` and fixes in `16.3.3` / `15.5.24`. The installed version falls in the affected range. Runtime prerequisites and exploitability on this deployment were not established. [Official advisory GHSA-2xp9-vwfh-vxw4](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4).

Audit counts describe affected packages, not 16 proven live exploits. Some findings involve build/tooling or feature-specific paths. Upgrade to supported patched versions in a reviewed change, inspect transitive dependencies, rebuild and regression-test checkout, webhooks, authentication, images and deployment. Do not apply a blind force upgrade. No dependencies were changed here.

### S07 — High: payment retries and booking validation need stronger boundaries

**Evidence:** `apps/web/app/api/payments/create-session/route.ts` accepts a booking ID without ownership verification, creates another checkout session and replaces the stored session reference. Resource-booking checkout creation does not have the group-booking idempotency protection. In `apps/web/app/api/webhooks/stripe/route.ts`, lane expiry/failure handling targets a pending booking without requiring the event's session to match the currently stored session. An old checkout event can therefore affect a newer pending attempt.

The public booking POST also lacks complete server-side validation of service/resource eligibility and bookable hours. Pricing uses server-local date/hour methods rather than an explicit Europe/London business-time conversion and charges the duration using its starting-hour rate, creating a boundary-crossing pricing risk.

**Required remediation:** verify ownership/guest capability before payment operations; reuse or idempotently replace checkout attempts; bind every payment lifecycle mutation to the current attempt. Revalidate active resources, dates, durations, opening hours and availability server-side. Quote in minor units using London time and the correct rate for each interval. No checkout/payment mutations were exercised in this assessment.

### S08 — Medium–High: public endpoint abuse controls are incomplete

The booking POST uses an in-memory rate limiter, which is not a shared limit across serverless instances. No equivalent application-wide protection was found for admin login, enquiry email submission, group reservations or payment-session operations. Provider-side WAF settings were not reviewed, so this does not establish their absence.

Use distributed limits, request-size bounds, endpoint-appropriate bot controls, safe error responses and monitoring. Preserve accessibility and legitimate shared-network users. No load or spam testing was performed.

### S09 — Medium: response-header defence in depth

A production homepage HEAD response included HSTS (`max-age=63072000`). It did not include Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy or Permissions-Policy. This is a single inspected response, not a claim about every route.

Add a tested CSP (start with report-only), appropriate framing restrictions, nosniff, referrer and permissions policies. Account for Stripe and Supabase dependencies. Headers supplement, but do not fix, the access-control findings above.

### S10 — Database/auth configuration and account-history gap

Supabase catalog inspection found **17 public tables with RLS enabled and no policies**. This is deny-by-default for ordinary client access, **not** public exposure. Service-role access bypasses these restrictions. No public security-definer functions were found in the inspected metadata.

`apps/web/app/account/page.tsx` queries bookings directly with the customer client, but the absence of policies prevents the expected private history access. New resource bookings do not establish the required owner linkage, and the group-booking model needs an explicit ownership design. `bookings.user_id` references `public.users`, not directly `auth.users`; verify profile provisioning before using authentication IDs as foreign keys.

Implement narrowly scoped, tested owner access or an authenticated server endpoint. Do not disable RLS or add permissive policies to make history appear. Do not grant access merely because a supplied email matches a booking.

Supabase advisor also reported:

- Leaked-password protection disabled — enable where supported and verify password policy. [Password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- `btree_gist` installed in `public` — review a safe extension-schema migration with dependencies in mind. [Extension-in-public advisor](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).
- Informational RLS-without-policy notices — maintain deny-by-default until intentional policies exist. [RLS advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Positive controls observed

- Stripe webhook signature verification uses the raw body and rejects invalid/missing signatures.
- Paid-booking confirmation checks retrieved Stripe payment state, currency, amount, stored session and booking metadata; transitions are guarded against repeated confirmation. Discount implementation must preserve these controls while checking the new immutable net amount.
- Booking overlap exclusion constraints provide database-level protection for active bookings.
- Resend webhook processing verifies signatures, handles deduplication and forwards to a configured administrator rather than executing inbound email instructions.
- RLS is enabled across inspected public tables; admin bookings rejected an unauthenticated request.

## Remediation and release gates

1. **Immediate, with approval:** contain public booking/enquiry reads and cancellation; investigate access logs using privacy-preserving procedures; rotate previously shared server credentials. Assess whether incident response is required from evidence, not assumptions.
2. **Before the next feature release:** fix ownership and guest capabilities, redirect handling, admin authentication, payment-attempt binding and server-side quoting; patch dependencies.
3. **Before enabling coupons:** test original and discounted payment totals, stale/repeated events, concurrent redemption, account/guest parity and negative access-control cases. See [checkout implementation plan](../features/checkout-implementation-plan.md).
4. **Hardening:** distributed abuse controls, security headers, password protection, dependency alerts and auditable privileged actions.

Verification must include two separate customer identities, guests, and admins. Confirm each can access only authorised data; reject guessed IDs and email-only claims; ensure an old payment event cannot cancel a new attempt; ensure status never claims a refund without verified processing. Use synthetic records and provider test mode.

## Not covered / remaining uncertainty

No exhaustive penetration test, full repository-history secret scan, complete deployed-bundle review, Vercel/Meta/provider account-permission audit, backup restoration test, real-customer ownership test, or verification of every dependency advisory's runtime prerequisites was performed. Live secret settings, historical access and compromise status remain unknown. No remediation, deployment, coupon creation or external security report publication was performed as part of this documentation task.
