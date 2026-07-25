# Testing Guide

## Commands
```bash
npm run check:paths
npm run lint
npm run typecheck
npx drizzle-kit check --config=drizzle.config.ts
npm run test
npm run test:coverage
npm run build
npm audit --audit-level=high
```

## Unit Tests
Vitest is configured in `vitest.config.ts` and tests live under `tests/`.

Current examples:
- Smart search intent parsing.
- Chat context filters.
- MFA utility generation and validation.

## Integration Test Targets
Add tests for:
- Login and MFA challenge.
- RBAC permission checks.
- Merchant product creation.
- Order creation and status transition.
- Upload validation failures.
- Contract renewal flow.

## E2E Targets
Recommended Playwright scenarios:
- Register/login.
- Admin login and dashboard.
- Merchant creates product.
- Customer browses store and product.
- Order checkout.
- Admin approves merchant/offer.

## Coverage Target
The enterprise target is 80%+. The repository now has the testing foundation; increase coverage gradually per module before release.
