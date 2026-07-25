# Monitoring and Observability

## Current Controls
- Audit logs for admin/auth/security events.
- Security alerts table for suspicious activity.
- Health endpoint.
- Contract cron health via configured cron route.
- CI lint/typecheck/build/audit/tests.

## Recommended Production Integrations
- Sentry for error and performance monitoring.
- Upstash Redis metrics for rate limiting.
- Managed PostgreSQL metrics for slow queries, locks, CPU and storage.
- Object storage access logs for media.

## Alert Channels
Configure alerts for:
- Failed login spikes.
- Admin login from new device/IP.
- Mass delete/update activity.
- Upload scan rejection spikes.
- DB connection failures.
- Cron failures.

## Sentry Installation Plan
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```
Use project DSN through environment variables only.
