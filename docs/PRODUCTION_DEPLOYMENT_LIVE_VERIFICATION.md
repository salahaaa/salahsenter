# Production Deployment & Live Verification Runbook

> This runbook makes the platform **ready for production deployment and live verification**. It does not replace executing the checks against the real Vercel/database/Redis/ERP accounts.

## 1. Required infrastructure

| Area | Requirement | Verification |
|---|---|---|
| API / errors | Sentry DSN and alert routing | Create a staging test error; verify Sentry event and `platform_structured_logs` |
| PostgreSQL | Provider pooler/PgBouncer URL; `DATABASE_POOLER_ENABLED=true`; `DB_POOL_MAX=3` for serverless | `/admin/observability`, `pg_stat_activity`, readiness check |
| Redis | Upstash/Vercel KV REST URL + token | `/api/health?deep=1`, central monitoring Redis service |
| Queue | Cron + worker active | Queue dashboard, dead-letter count zero |
| Backups | Private S3/R2 bucket + media host allowlist + recovery database | automatic backup audit + `npm run backup:recovery-test` |
| ERP | scoped client token and staging integration agent | reconciliation dashboard + ERP k6 test |

## 2. Monitoring stack

The central dashboard `/admin/observability` aggregates:

- API traffic, latency, error logs and request samples.
- PostgreSQL health, connection usage, locks, deadlocks and slow queries.
- Redis connectivity and DB size.
- Queue queued/retry/failed/dead-letter signals.
- ERP retry queue, failed syncs, stale reservations, awaiting invoices and negative available inventory.
- Sentry, Prometheus `/api/metrics`, Grafana configuration, incidents and structured logs.

Protect `/api/metrics` with `METRICS_TOKEN`, configure Prometheus scraping, and create alerts for:

```text
platform_health_score < 80
platform_services_down > 0
platform_db_connections_usage_percent > 70
platform_queue_failed_jobs > 0
platform_erp_failed_syncs > 0
platform_inventory_negative_available > 0
platform_api_p95_response_ms > 1500
```

## 3. Queue and ERP reliability

- Jobs retry with exponential backoff.
- Exhausted jobs move to `dead_letter` with reason and timestamp.
- Operators can inspect/requeue DLQ jobs from `/admin/observability/queue`; every requeue is audited.
- ERP failures are tracked in `integration_failed_syncs`; retry and reservation-expiry actions are exposed in `/admin/integrations/reconciliation`.
- Before release and after any ERP incident run:

```bash
npm run reliability:verify
```

It verifies idempotency, duplicate inventory movements, negative inventory, stale reservations, retry queue and failed syncs.

## 4. Financial and inventory reliability

- Orders use idempotency keys.
- Atomic reservation uses a conditional SQL update, preventing concurrent oversell.
- Expired reservations are released by cron.
- Order settlement, payment state, refund and payout actions have financial audit categories.
- Inventory adjustments, reservation, release and bulk updates have inventory audit categories.
- Reconciliation dashboard is the operational source for recovery actions; never repair balances or stock directly in production SQL without an incident record and an audit entry.

## 5. Staging test sequence

```bash
npm run migrations:verify
npm run security:verify
npm run test
npm run test:e2e:platform
npm run test:e2e:http
npm run reliability:verify
```

Load tests require explicit confirmation and staging target:

```bash
k6 run -e LOAD_TEST_CONFIRM=true -e APP_ENV=staging -e BASE_URL=https://staging.example.com scripts/load/k6-enterprise-readiness.js
k6 run -e LOAD_TEST_CONFIRM=true -e APP_ENV=staging -e BASE_URL=https://staging.example.com ... scripts/load/k6-checkout-inventory-concurrency.js
k6 run -e LOAD_TEST_CONFIRM=true -e APP_ENV=staging -e BASE_URL=https://staging.example.com -e INTEGRATION_TOKEN=... -e INTEGRATION_CLIENT_ID=... scripts/load/k6-erp-reliability.js
```

## 6. Capacity planning acceptance criteria

Establish a baseline on staging using production-like data, then scale load in steps: 25%, 50%, 75%, 100%, and 125% of expected launch traffic.

A stage passes only when:

- API p95 < 1.5 seconds, p99 < 3 seconds.
- 5xx rate < 1% and total request failure rate < 3%.
- Checkout known business conflicts (409 stock/idempotency) are separated from server errors.
- DB pool use stays below 70%; locks/deadlocks do not trend upward.
- Redis has no evictions and queue lag does not grow continuously.
- `npm run reliability:verify` is green after the test.

Document the highest passing load, DB connections, Redis usage, worker throughput and Vercel function duration; use it as the initial launch capacity baseline.

## 7. Live deployment gate

Before enabling public traffic:

1. Apply the protected migration workflow.
2. Run `npm run production:readiness -- --strict` with production secrets available in the secure runner.
3. Confirm daily automated backup succeeds and perform a recovery drill into an isolated DB.
4. Confirm Sentry receives a controlled staging error and alerts reach the operations team.
5. Confirm no DLQ jobs, failed ERP syncs, negative stock, duplicate idempotency keys or stale reservations.
6. Confirm Google OAuth, payment webhooks, checkout and ERP staging integration with real provider sandbox accounts.
7. Capture the evidence links in the release ticket.

## Incident priority

- **P1:** payment/checkout outage, data loss, DB connection exhaustion, auth compromise.
- **P2:** DLQ event, ERP failed sync, reconciliation mismatch, sustained p95 degradation.
- **P3:** noncritical queue retry, isolated media backup failure, warning-level monitoring alert.
