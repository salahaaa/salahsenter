# Security Policy

## Required Production Secrets
The application refuses to sign/verify JWT sessions without:

```env
JWT_SECRET=<long-random-secret>
```

For production also configure:

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
DATABASE_URL=
CRON_SECRET=
```

## Security Controls
- JWT secret is mandatory; no fallback secret exists.
- Session cookies are HTTP-only, SameSite=Lax, Secure in production.
- CSRF double-submit token is enforced on mutating API requests.
- Security headers are applied from middleware.
- Admin MFA supports TOTP, backup codes and recovery codes through API endpoints.
- Rate limiting uses Upstash Redis in production and memory only in local development.
- Uploads enforce MIME, extension allowlist, magic bytes, max size and malware scan hook.

## Reporting Vulnerabilities
Report privately to the project owner. Do not open public issues containing exploit details.

## MFA Endpoints
```txt
POST /api/auth/mfa/setup
POST /api/auth/mfa/verify
POST /api/auth/mfa/disable
```

## Session Endpoints
```txt
GET    /api/auth/sessions
DELETE /api/auth/sessions
```
