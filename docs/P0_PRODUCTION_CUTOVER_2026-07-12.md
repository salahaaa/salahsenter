# P0 Production Cutover — 2026-07-12

## Purpose

This runbook closes the P0 release blockers around seed accounts, payment configuration exposure, signed payment webhooks, migration history, and secret verification.

## Mandatory release sequence

1. **Freeze writes** briefly or put checkout/payment administration in maintenance mode.
2. **Rotate credentials before deployment** if the previous production database ever ran `npm run db:seed` or stored gateway configuration in `payment_methods.config`:
   - reset administrator passwords;
   - revoke all active administrator sessions;
   - rotate Stripe/local-gateway API keys and webhook secrets;
   - review `audit_logs` and provider dashboards for suspicious activity.
3. In GitHub Actions, run **Apply database migrations** against the protected `production` environment. The workflow now runs only:
   ```bash
   npm run migrations:verify
   npx drizzle-kit check --config=drizzle.config.ts
   npm run db:migrate
   ```
   It serializes migration execution with a production concurrency lock.
4. Confirm migration `0046_payment_method_config_hardening` completed. It retains only customer instruction fields and removes endpoint/key/header fields from existing payment JSON config.
5. Configure gateway secrets only in the deployment secret store, never in database JSON fields:
   ```text
   STRIPE_SECRET_KEY
   STRIPE_WEBHOOK_SECRET
   LOCAL_GATEWAY_API_URL
   LOCAL_GATEWAY_REFUND_URL            # optional
   LOCAL_GATEWAY_AUTHORIZATION_HEADER  # optional; defaults to Authorization
   LOCAL_GATEWAY_MERCHANT_ID           # optional
   LOCAL_GATEWAY_WEBHOOK_SECRET
   PAYMENT_PROVIDER_API_KEY
   ```
6. Register exactly these incoming webhook URLs with the providers:
   ```text
   /api/payments/stripe/webhook
   /api/payments/local-gateway/webhook
   ```
   They are the only payment paths exempted from browser CSRF. Both reject missing secrets/signatures and record an audit event for accepted, rejected, duplicate, unmatched, and error outcomes.
7. In the provider sandbox, verify:
   - a valid event marks only its matching payment/order as paid;
   - the same event replay is returned as duplicate with no second state change;
   - invalid/missing/stale signatures are rejected;
   - `audit_logs` contains the outcome and payload SHA-256, not raw credentials.
8. Confirm public checkout response does not contain `config`, `apiKey`, `secret`, `token`, endpoint URLs, headers, or merchant account internals.
9. Run the release verification suite:
   ```bash
   npm run check:paths
   npm run lint
   NODE_OPTIONS=--max-old-space-size=1400 npm run typecheck
   npm test
   npm run migrations:verify
   npm run security:verify
   ```

## Account/bootstrap policy

- `npm run db:seed` is permanently blocked when the runtime identifies production. It has no user-account creation logic.
- Demo/fixture/import/e2e write scripts are explicitly blocked on production and require a dedicated non-production confirmation variable.
- For a newly initialized database, migration `0047_core_rbac_reference_data` provides RBAC reference rows. Create the first administrator once, from a secure shell only:
  ```bash
  ALLOW_ADMIN_BOOTSTRAP=true \
  ADMIN_EMAIL='operator@example.com' \
  ADMIN_PASSWORD='<unique 16+ character secret>' \
  ADMIN_NAME='Platform Operator' \
  npm run admin:bootstrap
  ```
- The bootstrap command fails if an active super administrator already exists, if values are absent, or if the password resembles a placeholder/demo value.

## Forbidden production commands

```bash
npm run db:push
npm run db:seed
npm run import:aratat-demo
npm run import:ui-fixtures
npm run enrich:product-options
```

## Evidence to retain with the release

- Successful migration workflow run URL and commit SHA.
- Output of `npm run migrations:verify`.
- Output of `npm run security:verify`.
- Payment-provider sandbox evidence for signature/replay testing.
- Snapshot of post-release `production:readiness` result.
