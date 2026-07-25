import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

export const options = {
  scenarios: {
    cart_operations: { executor: 'constant-arrival-rate', rate: Number(__ENV.CART_RATE || 10), timeUnit: '1s', duration: __ENV.CART_DURATION || '2m', preAllocatedVUs: 20, maxVUs: 100, exec: 'cartOperations' },
    checkout_concurrency: { executor: 'constant-arrival-rate', rate: Number(__ENV.CHECKOUT_RATE || 3), timeUnit: '1s', duration: __ENV.CHECKOUT_DURATION || '2m', preAllocatedVUs: 20, maxVUs: 100, exec: 'checkoutConcurrency', startTime: '10s' }
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],
    checkout_error_rate: ['rate<0.05'],
    negative_stock_guard_conflicts: ['count>=0']
  }
};

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/$/, '');
if (__ENV.LOAD_TEST_CONFIRM !== 'true' || !BASE_URL || __ENV.APP_ENV === 'production') {
  throw new Error('Load tests require LOAD_TEST_CONFIRM=true, an explicit staging BASE_URL, and APP_ENV must not be production.');
}
const AUTH_COOKIE = __ENV.AUTH_COOKIE || '';
const STORE_ID = __ENV.STORE_ID;
const PRODUCT_ID = __ENV.PRODUCT_ID;
const VARIANT_ID = __ENV.VARIANT_ID;
const PAYMENT_METHOD_ID = __ENV.PAYMENT_METHOD_ID;
const SHIPPING_METHOD_ID = __ENV.SHIPPING_METHOD_ID;
const QUANTITY = Number(__ENV.QUANTITY || 1);

export const checkoutLatency = new Trend('checkout_order_create_latency');
export const cartLatency = new Trend('cart_update_latency');
export const checkoutErrorRate = new Rate('checkout_error_rate');
export const negativeStockGuardConflicts = new Counter('negative_stock_guard_conflicts');

function requireEnv() {
  if (!AUTH_COOKIE || !STORE_ID || !PRODUCT_ID || !VARIANT_ID || !PAYMENT_METHOD_ID || !SHIPPING_METHOD_ID) {
    throw new Error('Required env: AUTH_COOKIE, STORE_ID, PRODUCT_ID, VARIANT_ID, PAYMENT_METHOD_ID, SHIPPING_METHOD_ID');
  }
}

function authHeaders(extra = {}) {
  return { headers: { Cookie: AUTH_COOKIE, 'Content-Type': 'application/json', ...extra } };
}

export function cartOperations() {
  requireEnv();
  const payload = JSON.stringify({ mode: 'merge', items: [{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: QUANTITY }] });
  const res = http.post(`${BASE_URL}/api/cart`, payload, authHeaders());
  cartLatency.add(res.timings.duration);
  check(res, { 'cart no 5xx': (r) => r.status < 500, 'cart accepted/limited': (r) => [200, 201, 400, 401, 403, 409, 422, 429].includes(r.status) });
  sleep(Math.random());
}

export function checkoutConcurrency() {
  requireEnv();
  const idempotencyKey = __ENV.FIXED_IDEMPOTENCY_KEY ? `k6-fixed-${__VU}` : `k6-${__VU}-${__ITER}-${Date.now()}`;
  const payload = JSON.stringify({
    storeId: STORE_ID,
    paymentMethodId: PAYMENT_METHOD_ID,
    shippingMethodId: SHIPPING_METHOD_ID,
    currency: __ENV.CURRENCY || 'YER',
    items: [{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: QUANTITY }],
    deliveryAddress: { city: 'k6', addressLine: 'k6 checkout concurrency' },
    customerNote: 'k6 checkout inventory concurrency test'
  });
  const res = http.post(`${BASE_URL}/api/orders`, payload, authHeaders({ 'Idempotency-Key': idempotencyKey }));
  checkoutLatency.add(res.timings.duration);
  const known = [200, 201, 400, 401, 403, 409, 422, 429].includes(res.status);
  checkoutErrorRate.add(res.status >= 500 || !known);
  if (res.status === 409) negativeStockGuardConflicts.add(1);
  check(res, { 'checkout no 5xx': (r) => r.status < 500, 'checkout known status': () => known });
}
