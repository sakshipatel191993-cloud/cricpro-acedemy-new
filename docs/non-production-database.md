# Isolated non-production database

Provisioned on 23 September 2026 for local review of the merged features.

| Environment | Project | Reference | Use |
| --- | --- | --- | --- |
| Production | ngca | `gcchcsmphxdmktojztlf` | Existing live site; not modified by this setup |
| Non-production | cricpro-nonprod | `azmakhbzqhkyqmqtzbqa` | Local development and isolated verification only |

Both projects belong to the Cricpro organization and use `ap-northeast-1`.
Supabase quoted $0/month for creation. No paid upgrade, deployment, production
environment edit, continuous replication or production migration was performed.

## What was copied

This is a one-time application database snapshot, not a physical backup or a
continuously synchronised replica. The source only recorded one migration, so
its actual PostgreSQL catalogs were inspected instead of assuming the repository
contained a complete baseline. Source access was read-only.

- 17 original public tables, eight enums, constraints, indexes, two application
  trigger functions, four triggers, grants and row-level security settings.
- Six resources (including all four active lanes), 42 availability rules,
  38 pricing rules, one coach and four group/masterclass sessions.
- 83 resource bookings, 12 group bookings and seven enquiries, anonymised in
  the source SELECT before export. Business resource/session identifiers and
  booking intervals/statuses were preserved; customer record identifiers and
  booking references were replaced with non-production identifiers.
- Names/emails were replaced with synthetic values using `example.invalid`;
  telephone numbers, medical/emergency details, ages, notes, free-text enquiry
  content and metadata, consent payloads and Stripe session IDs were removed.
- Auth users/passwords/sessions, notification queues, webhook event history,
  audit logs, provider credentials and external schedulers were not copied.
  Storage objects, Edge Functions and project-level Auth settings are outside
  this application database snapshot.
- Group capacity triggers were disabled only in the destination seed transaction
  and re-enabled before commit, preserving copied occupancy without double-counting.

The five new guest-access, recovery, quote, group-idempotency and coupon migrations
were applied only to non-production. The existing WhatsApp tables/functions were
included in the baseline. The `btree_gist` extension was then relocated to the
`extensions` schema in non-production to resolve the advisor warning.

## Local configuration and safety

`apps/web/.env.local` now targets only `cricpro-nonprod`. The former local settings
are preserved in `apps/web/.env.production-source-backup`; Next.js does not
automatically load that custom filename. Both files are Git-ignored. Do not commit
either file or use `vercel env pull` to overwrite the non-production configuration.

- Use only the new project's publishable key and server-only secret/service-role
  key. Never reuse the production database URL or service-role key.
- `DATABASE_URL` is blank: the app uses Supabase's API. If SQL tooling needs a
  connection string, obtain one for **the non-production project only**.
- Initially all external providers were disabled for isolation. At the user's
  explicit request, local Stripe **test-mode** payments and Resend sending are
  now enabled. Only those settings were restored from the ignored backup; the
  non-production database and its independent security secrets were preserved.
- Email routing matches production: `noreply@cricprocoe.com` sends customer emails
  to the submitted booking address and admin messages to `info@cricprocoe.com`.
  These are real emails; use approved recipients or Resend's `delivered@resend.dev`
  test recipient for automated customer tests. No blanket recipient override exists.
- `WHATSAPP_ENABLED`, `NEXT_PUBLIC_WHATSAPP_ENABLED` and `WHATSAPP_ADMIN_ENABLED`
  remain false, with provider credentials blank. No WhatsApp messages are sent.
- The official Stripe CLI forwards test checkout events to
  `http://localhost:3000/api/webhooks/stripe`; its separate signing secret is stored
  only in ignored `.env.local`. The running listener is needed for local webhook
  delivery. It does not create/change a hosted production webhook. Resend inbound
  routing remains unchanged; local receiving webhooks are not publicly exposed.
- A separate local admin password, signing secret, coupon identity secret and
  limiter secret were generated. Read the ignored local file to get the local
  admin password; existing production admin cookies will not authenticate here.
- The local-only in-memory rate limiter is explicitly enabled, with namespace
  `cricpro_nonprod`. A hosted preview still needs its own shared Redis configuration;
  this development fallback is ignored in production runtime mode.
- Quote, guest-access and coupon feature flags are enabled only for this isolated
  local environment after its migrations. Coupon presets do not silently create
  or activate records. The initial empty coupon table caused the local checkout
  message "This coupon is not available"; the two agreed test codes have now
  been explicitly created through the local admin API (see below).

### Test coupons

`COACH15` (15%) and `COACH20` (20%) are active **only in non-production**.
Each allows 50 successful uses, with the existing shared one-discount-per-customer
rule and pending reservations counting against available capacity. Their 30-day
window is 22 September 2026 00:00 to 22 October 2026 00:00, Europe/London (exclusive
expiry), using the UK calendar date at activation. Both started with zero uses.
Manage, pause or archive them at `/admin/coupons`. No production campaign was
created or activated, and no automatic seed was added to application startup or
the migration chain.

### Time and pricing interpretation

Copied timestamps are retained verbatim as stored UTC instants. No historical or
future production booking was shifted. New quotes use Europe/London conversion.
The non-production timezone flag is **not** approval to migrate production:
legacy bookings may represent UTC-labelled venue wall time and require individual
review before enabling production. In this copy, legacy appointments can therefore
display a different local hour than originally intended.

The copied active rules completely cover Monday–Friday 15:00–23:00 (off-peak
15:00–17:00) and weekends 09:00–23:00 (all peak). Prices are interpreted as GBP/hour.
Active rules take precedence over legacy resource fallback prices; some inactive
rules and old fallback values are inconsistent and were retained for fidelity.

## Verification

- Database checks: four active lanes, 83/12 copied booking records, zero unsafe
  customer fields, no copied Auth users or queued notification jobs.
- Five rollback-only SQL suites passed on the hosted non-production database:
  guest access, payment recovery, authoritative quotes, coupons and the merged
  WhatsApp/email transaction tests. No real provider requests were made.
- 408 hourly quotes across all six copied resources and all seven weekdays passed
  a local audit against the copied pricing configuration. Off-peak/peak boundary
  totals and summer/winter London conversion also passed.
- Supabase security advisor: no warning/error after extension relocation; 26
  informational RLS-without-policy findings are expected for tables accessed only
  through the server's privileged client. Browser-role access was tested. See
  [Supabase's RLS advisory](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- The new project's publishable and server-only secret keys are installed in the
  ignored local configuration. A direct API query confirmed the non-production
  project and four active lanes; all external-provider switches/credentials were
  checked before restarting the app at `http://localhost:3000`.
- Local HTTP checks passed for every lane: eight hourly slots on 24 September
  and fourteen on 26 September, at the expected weekday/weekend rates. Machine
  and side-arm slots, group/masterclass listing, admin login, the 83 anonymised
  admin booking records and coupon management all returned HTTP 200.
- A persisted, short-lived local quote for 16:00–18:00 returned the expected
  GBP 40 total. No booking or payment was created. A payment-submission probe
  correctly returned the deliberately disabled-payment response.
- Coupon follow-up: reproduced the missing-code error, then created both test
  codes through the authenticated admin API. All ten discount previews passed
  (both codes for lane hire, bowling machine, side-arm, group and masterclass).
  Whitespace/case normalization, rejection of unknown codes and quote-access
  checks passed. Verification created only short-lived quotes, not bookings,
  payments or coupon redemptions. External integrations were disabled for that
  initial preview-only check; see the subsequent integration checks below.
- Browser screenshot and DOM confirmed the lane page, all four lane tabs and no
  captured console warnings/errors. Automated calendar clicks timed out at the
  browser-control layer, so interactive calendar/checkout review remains manual;
  the slot API coverage above was verified directly. The preview is left open.

### Local payment/email follow-up

- Stripe accepted a synthetic test checkout with `COACH15`: GBP 15.00 subtotal,
  GBP 2.25 discount, GBP 12.75 payable. Unpaid verification returned HTTP 402.
  That synthetic checkout was then explicitly expired; the signed expiry webhook
  returned HTTP 200, cancelled only its test hold and released its coupon use.
- A separate user-completed test payment was confirmed in non-production. Its
  signed completion webhook returned HTTP 200; WhatsApp job count remained zero.
- A real integration check exposed `PGRST201`: adding `pricing_resource_id` made
  unqualified booking-to-resource embeds ambiguous. Notification delivery,
  payment-success details and admin/customer booking reads now explicitly select
  `bookings_resource_id_fkey`. Success details handle both object/array relation
  responses. Regression tests cover these cases.
- Emails/PDF attachment inputs for quote-backed bookings now render stored UTC
  instants in Europe/London, including summer time; historical rows without a
  quote keep their existing interpretation pending the production timezone audit.
- Retried the user's existing two queued notifications after the query fix.
  Resend delivered the admin message. The customer request includes confirmation
  and receipt PDFs plus Google Maps, but Resend suppressed delivery because that
  recipient had a pre-existing bounce suppression. This is **not** a verified
  customer-inbox delivery. No suppression was removed or booking email changed.
- A clearly labelled local enquiry test was accepted for both the real configured
  admin inbox and Resend's test customer address. No production data was changed.

Local snapshot/seed/audit artifacts are under ignored `.cli-data/nonprod/`, not
part of the application migration chain. Do not apply these seed or baseline
files to production. A later refresh needs an explicitly reviewed destination
and anonymisation pass; never drop/reset either database as an implicit refresh.

## Before production rollout

Complete customer-inbox verification using a correct, deliverable address and
review both PDFs before deployment. Local Stripe credentials must remain test-mode;
never substitute live keys. Resend is intentionally shared for this authorised
email test, so its sends count against the existing account and can reach real inboxes.
Review production migrations, timezone interpretation, real payment keys, shared
limiter storage, webhook URLs and recovery-worker configuration independently.
Local success alone is not production readiness. No deployment has been performed.
