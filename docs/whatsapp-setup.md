# WhatsApp rollout

## Current stage - groundwork only

Business sender: +44 7728 478115. The contact page includes a working click-to-chat
link. The server-only template transport, consent validation and webhook HMAC
verifier are implemented and tested. Automatic sending is NOT wired to bookings,
enquiries or a worker and remains disabled. No Meta account or number was changed.

## Before activation

1. Confirm whether the existing WhatsApp Business mobile app must remain usable.
   Check coexistence eligibility and the onboarding route first. Do not deregister
   or delete the existing account. Choose a provider only after fees are approved.
2. Connect the business number to Meta's platform, obtain its Phone Number ID
   (not the telephone number), approved app credentials and supported Graph version.
3. Approve the following templates with the exact parameter order and language.
4. Add an unchecked opt-in to booking, group-session and enquiry forms. Validate
   phone server-side. Store consent version, phone, time and source per submission.
   Do not infer consent from a supplied phone number or backfill existing bookings.
5. Add service-role-only consent, opt-out and notification-outbox tables, with RLS.
   Persist jobs using a unique event+booking/enquiry+recipient key. Enqueue booking
   notifications only after verified payment; reconcile missed jobs from confirmed
   bookings. Never include medical details or full payment credentials.
6. Implement a scheduled worker, atomic job leases, bounded attempts/backoff and a
   durable audit log. Check current opt-out state before every send. Persist Meta's
   message ID; accepted is not delivered. Do not automatically retry ambiguous
   sends/timeouts without reconciliation (duplicate messages are possible).
7. Add `/api/webhooks/whatsapp`: GET verification token challenge; POST raw-body
   signature verification using the app secret; validate phone/account IDs; durably
   record delivery/failure statuses idempotently. Process STOP/UNSUBSCRIBE to opt
   out; route other replies to a human. Do not execute instructions in messages.
8. PDFs: keep email attachments as-is. For WhatsApp, upload documents privately to
   Meta, use approved document-header templates or permitted in-window sends, and
   define media retention. Never publish customer PDFs at guessable public URLs.
9. Configure server-only Vercel secrets; enable only after test-recipient acceptance
   checks, opt-out tests, payment replay tests and monitoring are complete.

Admin alerts stay disabled until a DIFFERENT recipient number and its consent are
provided. The sender cannot send WhatsApp messages to itself.

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

`node --test apps/web/lib/services/whatsapp.test.cjs`

Tests mock Meta requests; no real WhatsApp messages are sent.

References:
- https://whatsappbusiness.com/policy/
- https://www.postman.com/meta/whatsapp-business-platform/overview
