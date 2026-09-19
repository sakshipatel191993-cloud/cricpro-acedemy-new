# WhatsApp rollout

## Current stage - integration built, sending disabled

Business sender: +44 7728 478115. The contact page includes a working click-to-chat
link. The app now has opt-in controls, server-stamped consent, durable notification
jobs, a bounded authenticated worker, and a signed webhook for delivery/STOP events.
The code is local, not deployed. No Meta account or number was changed.

The additive migration `supabase/migrations/20260919144026_whatsapp_notifications.sql`
has been applied to the linked database. It adds nullable consent fields and three
service-role-only tables; it does not opt in existing customers. Database triggers
queue one job per source/event/phone atomically with paid booking confirmation or
consented enquiry insertion. Both lane and group/masterclass paths are covered.
Rollback-only tests verified payment gating, consent and replay deduplication;
no test bookings, enquiries or notification jobs remain.

`NEXT_PUBLIC_WHATSAPP_ENABLED` defaults off, hiding the opt-in controls until launch.
`WHATSAPP_ENABLED` defaults off and gates both consent capture and sending. Do not
enable one flag without the other. The public flag requires a rebuild. Email and
PDF delivery are unchanged. Free/unpaid bookings do not trigger WhatsApp alerts.

## Before activation

1. The user confirmed the existing WhatsApp Business mobile app MUST remain usable.
   Check coexistence eligibility and the onboarding route first. Do not deregister
   or delete the existing account. Choose a provider only after fees are approved.
2. Connect the business number to Meta's platform, obtain its Phone Number ID
   (not the telephone number), approved app credentials and supported Graph version.
3. Approve the following templates with the exact parameter order and language.
4. Run live test-recipient acceptance checks before exposing the opt-in. No historical
   bookings are backfilled. Consent is saved on the original record, with source
   table/ID recorded in each job. Reconfirm current phone, paid status and opt-out
   state immediately before a send. Never include medical or full payment details.
5. Configure a trusted scheduler to POST `/api/whatsapp/process` with
   `Authorization: Bearer <WHATSAPP_WORKER_SECRET>` (at least 32 random characters).
   No scheduler is enabled yet. Each invocation claims at most three jobs using a
   compare-and-swap update. Tune cadence/capacity before launch. Explicit 429s retry
   with bounded backoff; interrupted, 5xx and uncertain sends are quarantined for
   operator review. Do NOT blindly retry them. Jobs older than 24h are skipped.
6. Register `/api/webhooks/whatsapp` in Meta and subscribe to messages. GET handles
   verification; POST checks raw-body HMAC, account and phone ID before storing
   delivery statuses or STOP commands. `whatsapp_delivery_events` is a deduplicated
   status audit, not an inbox. A job marked `accepted` is not evidence of delivery.
   Keep processing STOP callbacks even while the sending flag is disabled.
7. Confirm human reply handling in the retained Business app. Other inbound messages
   are ignored by this webhook. STOP is permanent suppression until a verified
   re-subscription process is implemented; checking a later form does not clear it.
8. PDFs: keep email attachments as-is. For WhatsApp, upload documents privately to
   Meta, use approved document-header templates or permitted in-window sends, and
   define media retention. Never publish customer PDFs at guessable public URLs.
9. Configure server-only Vercel secrets; enable only after test-recipient acceptance
   checks, opt-out tests, payment replay tests and monitoring are complete.

Admin alerts stay disabled until a DIFFERENT recipient number and its consent are
provided, and admin jobs are implemented. The current worker handles CUSTOMER jobs
only. The sender cannot send WhatsApp messages to itself.

Before launch, define retention/cleanup for consent, jobs and delivery events, add
operator monitoring for failed/ambiguous jobs, and review public-form abuse controls.
No scheduler, paid provider subscription or live WhatsApp messages were created.

Security advisor: the new tables have RLS and no anon/authenticated grants or policies
(intentionally server-only). Existing project warnings remain for `btree_gist` in
public and disabled leaked-password protection; these were not changed here.
See https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public
and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Template drafts (utility review required; approval is not guaranteed)

- `cricpro_booking_confirmed`: "Hi {{1}}, your Cricpro booking {{2}} is confirmed.
  Session: {{3}}. Schedule: {{4}}. Reply STOP to stop WhatsApp updates."
- `cricpro_enquiry_received`: "Hi {{1}}, we have received your {{2}} enquiry at
  Cricpro. Our team will contact you soon. Reply STOP to stop WhatsApp updates."
- `cricpro_admin_booking`: "New confirmed Cricpro booking {{1}}. Service: {{2}}.
  Schedule: {{3}}. View full details in the admin dashboard."
- `cricpro_admin_enquiry`: "New Cricpro enquiry {{1}}. Type: {{2}}.
  View the customer's message in the admin dashboard."

Template names in environment variables must match approved Meta templates.
Use a separate feature flag for admin alerts. Marketing is out of scope.

## Test command

Local interactive demo: `http://localhost:3000/dev/whatsapp-demo` while running
`next dev`. Fictional data only, with unchecked opt-in and simulated delivery,
failure, STOP and unpaid scenarios. Uses the real template transport with an
injected fake provider (no network, database, checkout or email side effects).
Both the page and endpoint are unavailable in production; live flags stay off.

`node --test apps/web/lib/services/whatsapp.test.cjs`

Tests mock Meta requests; no real WhatsApp messages are sent.

References:
- https://whatsappbusiness.com/policy/
- https://www.postman.com/meta/whatsapp-business-platform/overview
