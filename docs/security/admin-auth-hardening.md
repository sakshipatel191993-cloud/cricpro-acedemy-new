# Admin authentication hardening

Local implementation, 22 September 2026. Not a claim of deployed protection.

- No built-in admin password or signing-secret fallback. Missing/invalid configuration disables login and rejects sessions.
- Configure a unique random `ADMIN_PASSWORD` of at least 12 characters and a separate cryptographically random `ADMIN_SECRET` of at least 32 characters (recommend 32 random bytes encoded as hex). Known starter password and placeholder secrets are rejected. Length checks cannot establish actual randomness.
- Update secrets through the deployment secret manager and redeploy/restart every active instance. Never commit them. Changing `ADMIN_SECRET` invalidates all previous cookies on instances using the new value; changing only the password does not revoke existing cookies. Existing unexpired cookies remain compatible when valid configuration is unchanged.
- Cookie HMAC verification uses Web Crypto; malformed, duplicate, expired and future-dated session tokens are rejected. Password comparison uses HMAC verification rather than variable-time string equality.
- Admin API mutations require an exact matching Origin, in middleware and in the login/logout handlers. Direct API clients must supply the same-origin header in addition to their authenticated session; Origin alone is not authentication.
- Login attempts are limited to five per IP and 100 globally per process per 15 minutes, including successful attempts. The existing limiter is memory-only: replicas/restarts do not share counters and forwarded IP trust depends on deployment. Add a trusted edge/WAF or distributed rate limiter before considering brute-force protection complete. The global cap also creates a denial-of-service tradeoff.
- Customer and admin login/signup return URLs are limited to local page paths; executable URLs, external/protocol-relative destinations and ambiguous encodings are rejected.

Remaining work: role-based individual admin identities with MFA, server-side revocable sessions, distributed throttling, and deployment-time rotation of credentials previously exposed in chat. Logout clears the browser cookie but does not individually revoke an already stolen copy. These changes do not implement those remaining controls or rotate live credentials.
