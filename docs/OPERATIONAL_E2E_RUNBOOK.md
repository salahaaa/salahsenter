# Operational E2E Runbook

Run end-to-end tests only on an isolated staging database. The write-capable E2E scripts are blocked in production.

## 1. Platform full-cycle smoke test

```bash
DATABASE_URL=<staging-db-url> \
APP_ENV=staging \
npm run test:e2e:platform
```

The runner sets `E2E_ALLOW_STAGING_WRITE=true` and validates the following in a transaction-backed staging flow:

| Journey | Verified steps |
|---|---|
| Admin | platform/store roles, employees, approval-oriented operations, promotions |
| Merchant | merchant store, category, units, variants, inventory, announcements, offers, finance/payout data |
| Customer | address, wishlist, review, order return request |
| Full order cycle | idempotency, atomic inventory reservation, payment receipt, shipment, status lifecycle, settlement, refund ledger, background jobs |
| Integrity | no negative stock, no duplicate idempotency keys, no duplicate order inventory movements |

The script generates run-scoped users and data; generated credentials are not printed.

## 2. HTTP/UI-facing regression test

Start the application against the staging/local database, then run:

```bash
E2E_HTTP_CONFIRM=true \
E2E_BASE_URL=http://localhost:3000 \
TEST_ADMIN_EMAIL=<staging-admin-email> \
TEST_ADMIN_PASSWORD=<secret> \
TEST_MERCHANT_EMAIL=<staging-merchant-email> \
TEST_MERCHANT_PASSWORD=<secret> \
TEST_CUSTOMER_EMAIL=<staging-customer-email> \
TEST_CUSTOMER_PASSWORD=<secret> \
npm run test:e2e:http
```

This verifies authenticated HTTP paths, CSRF-aware requests, admin/merchant/customer APIs, visibility behavior, and UI-facing responses. It must never target production.

## Release gate

Before production release, retain output for:

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e:platform   # staging only
npm run test:e2e:http       # staging/local only
npm run migrations:verify
npm run security:verify
```
