# Customer email verification

- Production Supabase project: `gcchcsmphxdmktojztlf` (`ngca`). Keep **Confirm email** enabled.
- Site URL: `https://www.cricprocoe.com`. Never use localhost as the production fallback.
- Allowed redirects: `/account` and `/reset-password` on both `https://www.cricprocoe.com` and `https://cricprocoe.com` (exact URLs).
- Signup explicitly requests the current site's `/account` URL. The browser Supabase client consumes the confirmation session from the redirect.
- Login, the customer auth context, and authenticated customer APIs require Auth's server-controlled `email_confirmed_at`; user metadata is not proof of verification.
- Do not rotate passwords or signing secrets without the owner's explicit permission.

Verified on 2026-09-24 with a temporary production test account: password login rejected before confirmation, generated signup link redirected to the production account page, and login succeeded after confirmation. The test account was signed out and deleted. This checked the verification endpoint without sending a test email. Existing customer accounts were not modified.
