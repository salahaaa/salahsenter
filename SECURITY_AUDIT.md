# Security Audit — Salah Center Marketplace

## Scope
OWASP Top 10, CWE mapping, API access control, file uploads, sessions, JWT, CSRF, and production readiness review.

## Executive Summary
The platform now includes enforced JWT secrets, security headers, CSRF double-submit tokens, Redis/Upstash-ready rate limiting, hardened uploads, TOTP MFA foundation for admins, device/session tracking, and automated security tests/checks.

## OWASP Top 10 Review
| OWASP | Status | Controls |
|---|---:|---|
| A01 Broken Access Control | Mitigated | Middleware role gates, `requireAuth`, RBAC helpers, store-scoped access checks, audit logs. |
| A02 Cryptographic Failures | Mitigated | No default JWT secret, secure cookies, bcrypt password hashing, SHA-256 session token hashes. |
| A03 Injection | Mitigated | Drizzle parameterized queries, no unsafe `sql.raw`, debug query uses tagged SQL. |
| A04 Insecure Design | Improved | Security gates, emergency lock, contract lifecycle controls, MFA/session infrastructure. |
| A05 Security Misconfiguration | Mitigated | CSP, HSTS, XFO DENY, nosniff, Referrer/Permissions/COOP/CORP/COEP. |
| A06 Vulnerable Components | Monitored | `npm audit --audit-level=high` in CI. Moderate Next/PostCSS advisory tracked. |
| A07 Identification/Auth Failures | Improved | Rate limiting, progressive delay, account lockout window, MFA APIs, sessions. |
| A08 Software/Data Integrity | Improved | CI checks, path safety check, migrations. |
| A09 Logging/Monitoring | Improved | Audit logs, security alerts, login auditing, health endpoints. |
| A10 SSRF | Partially mitigated | Uploads do not fetch arbitrary URLs server-side. Outbound providers use configured endpoints only. |

## CWE Mapping
- CWE-287 Improper Authentication: MFA, rate limiting, lockout, session tracking.
- CWE-352 CSRF: double-submit token enforced in middleware.
- CWE-79 XSS: removed `dangerouslySetInnerHTML`; CSP added.
- CWE-434 Unrestricted File Upload: MIME, extension, magic bytes, malware hook.
- CWE-89 SQL Injection: Drizzle tagged queries; no raw SQL concatenation.
- CWE-639 IDOR: store-scoped guards and RBAC are required in sensitive endpoints.

## Threat Model
Actors: anonymous visitors, customers, merchants, store employees, super admins, malicious insiders, automated bots.
Assets: user accounts, merchant stores, products, orders, contracts, media, audit logs.
Trust boundaries: browser ↔ API, API ↔ DB, API ↔ media storage, admin/merchant RBAC boundaries.

## Risk Matrix
| Risk | Likelihood | Impact | Status |
|---|---:|---:|---|
| JWT secret fallback abuse | Medium | Critical | Closed |
| CSRF on mutating APIs | Medium | High | Closed |
| Stored XSS via theme CSS | Medium | High | Closed |
| Upload of executable payload | Medium | High | Closed |
| Brute force login | High | High | Improved |
| Missing Redis in serverless | Medium | Medium | Closed for production; dev fallback only |
| Missing full E2E coverage | Medium | Medium | Open improvement |

## Penetration Test Checklist
- SQL Injection: use payloads in search/login/order APIs; expected parameterized handling.
- XSS/Stored XSS: test theme values, banners, news, product fields; expected escaping/sanitization.
- CSRF: POST without `x-csrf-token`; expected 403.
- JWT Forgery: missing/forged JWT; expected rejection.
- IDOR: access another store employee/product/order; expected 403/404.
- File Upload Attacks: `.php`, `.exe`, SVG, mismatched MIME; expected rejection.
- Rate Limit Bypass: repeated login attempts; expected delay/429/423.
- Session Hijacking: revoked session token; expected `requireAuth` failure.
