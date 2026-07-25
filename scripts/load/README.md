# Enterprise Load Testing

> Do not run destructive checkout/inventory tests against a shared production DB unless a dedicated staging dataset and test stock are prepared.

## 1) Public enterprise mixed test
Covers homepage, offers, wings, search, public APIs, and optionally authenticated dashboards if cookies are provided.

```bash
k6 run \
  -e LOAD_TEST_CONFIRM=true \
  -e APP_ENV=staging \
  -e BASE_URL=https://staging.example.com \
  -e SEARCH_QUERIES='الإلكترونيات,ذهب,مطاعم,عروض,لابتوب' \
  -e STORE_SLUGS='store-1,store-2' \
  -e PRODUCT_PATHS='/store/store-1/products/product-1,/store/store-2/products/product-2' \
  scripts/load/k6-enterprise-readiness.js
```

Optional dashboard traffic:

```bash
k6 run \
  -e LOAD_TEST_CONFIRM=true \
  -e APP_ENV=staging \
  -e BASE_URL=https://staging.example.com \
  -e ADMIN_COOKIE='mall_session=...' \
  -e MERCHANT_COOKIE='mall_session=...' \
  scripts/load/k6-enterprise-readiness.js
```

## 2) Checkout + inventory concurrency
Requires a dedicated staging customer session and a product variant with known stock.

```bash
k6 run \
  -e LOAD_TEST_CONFIRM=true \
  -e APP_ENV=staging \
  -e BASE_URL=https://staging.example.com \
  -e AUTH_COOKIE='mall_session=...' \
  -e STORE_ID='...' \
  -e PRODUCT_ID='...' \
  -e VARIANT_ID='...' \
  -e PAYMENT_METHOD_ID='...' \
  -e SHIPPING_METHOD_ID='...' \
  -e CART_RATE=10 \
  -e CHECKOUT_RATE=3 \
  scripts/load/k6-checkout-inventory-concurrency.js
```

## 3) ERP reliability load

Uses integration credentials against staging read/health endpoints and must not target production:

```bash
k6 run \
  -e LOAD_TEST_CONFIRM=true \
  -e APP_ENV=staging \
  -e BASE_URL=https://staging.example.com \
  -e INTEGRATION_TOKEN='<staging-integration-token>' \
  -e INTEGRATION_CLIENT_ID='<staging-client-id>' \
  -e STORE_ID='<optional-store-id>' \
  scripts/load/k6-erp-reliability.js
```

## 4) Legacy focused tests
```bash
k6 run -e BASE_URL=https://staging.example.com scripts/load/k6-search.js
k6 run -e BASE_URL=https://staging.example.com -e AUTH_COOKIE='mall_session=...' -e STORE_ID='...' -e PRODUCT_ID='...' -e VARIANT_ID='...' -e PAYMENT_METHOD_ID='...' -e SHIPPING_METHOD_ID='...' scripts/load/k6-checkout.js
```

## Metrics to capture
- p50 / p95 / p99
- `http_req_failed`
- throughput (`http_reqs/s`)
- checkout conflict rate (409 expected when stock is exhausted)
- DB CPU/connections/locks on provider dashboard
- Redis memory/hit rate/evictions on provider dashboard
- Vercel function duration and error rate

## Post-test DB checks
Run after checkout/inventory tests:

```sql
select count(*) from product_variants where stock_quantity < 0;
select reference_id, variant_id, type, count(*)
from inventory_movements
where reference_type='order'
group by reference_id, variant_id, type
having count(*) > 1;
select scope, key, count(*) from idempotency_keys group by scope, key having count(*) > 1;
```
