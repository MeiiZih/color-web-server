# ColorLab email verification

New registrations explicitly set `emailVerificationRequired: true`. Existing documents with this field absent (or false) remain optional and are not silently marked verified. The administrator collection and passwords are unchanged. Do not roll back to a build that issues sessions to unverified members.

## Hosting

Server-only Render variables: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` (ColorLab). Never store credentials in this repository, browser storage, screenshots, or logs. The existing Brevo sender is verified; Gmail is a freemail sender and Brevo recommends a verified custom domain for deliverability. Existing projects and sender settings are not modified.

The implementation uses HTTPS `POST https://api.brevo.com/v3/smtp/email`, not SMTP. Official API documentation: https://developers.brevo.com/docs/send-a-transactional-email

## Contract

- `POST /api/user/register`: 202 with `verificationRequired`, `mailSent`, email, and message. Never returns a member token. Missing mail configuration returns 503 without creating an account; provider failure retains a pending account for recovery.
- `/api/user/login`: authenticates password, then denies required/unverified users with 403. Legacy accounts remain allowed.
- `POST /api/user/email-verification/request`: optional verification for an authenticated legacy member, using the stored email.
- `POST /api/user/email-verification/resend`: email and password proof required. Does not change password, identity or legacy eligibility.
- `POST /api/user/email-verification/confirm`: random token and password required. Returns verification success, not an authentication session. User signs in normally afterwards.

Verification tokens are 32 random bytes; only SHA-256 hashes are stored. Tokens expire in 24 hours, are consumed atomically, and are invalidated by resending. MongoDB TTL removes expired token/counter documents. Confirmation explicitly checks expiry independently of TTL timing. Email links use a fixed frontend origin and hash fragment; the page removes the fragment token from browser history after reading it. GETs and mail-link scanners never confirm verification.

Persistent MongoDB limits: 60-second send cooldown; five sends per account per UTC day; 100 ColorLab send attempts per UTC day (preserves shared account quota); 30 verification operations per identity per 15 minutes and 1,000 globally per 15 minutes. No raw IP addresses are stored. Attempts count even if a provider fails. Limits are independent of Render's proxy/IP layout.

## Verification

Run `node --test Server/tests/email-verification.test.cjs Server/tests/account.test.cjs Server/tests/auth-client.test.mjs Server/tests/explore.test.cjs Server/tests/explore-client.test.mjs`. Build static output with `node scripts/build-static.cjs`, then run `node --test scripts/static-shell.test.cjs`.

Mocks test registration, no opt-out, no premature token, legacy compatibility, password proof, replay, expiry, resend, concurrency, quota, provider failure, missing configuration and normalized email. Real inbox delivery must additionally be verified after deployment; provider acceptance is not proof of inbox delivery.

API keys with no scheduled expiry can still expire after 90 days of inactivity. No automatic renewal or keepalive job is configured. Official policy: https://help.brevo.com/hc/en-us/articles/209467485-Create-and-manage-your-API-keys
