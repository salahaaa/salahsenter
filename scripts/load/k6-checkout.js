import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    checkout_concurrency: { executor: 'constant-arrival-rate', rate: Number(__ENV.RATE || 5), timeUnit: '1s', duration: __ENV.DURATION || '1m', preAllocatedVUs: 20, maxVUs: 100 }
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500']
  }
};

const BASE_URL = __ENV.BASE_URL || '';
if (__ENV.LOAD_TEST_CONFIRM !== 'true' || !BASE_URL || __ENV.APP_ENV === 'production') {
  throw new Error('Checkout load tests require LOAD_TEST_CONFIRM=true, an explicit non-production BASE_URL, and APP_ENV!=production.');
}
const COOKIE = __ENV.AUTH_COOKIE || '';
const STORE_ID = __ENV.STORE_ID;
const PRODUCT_ID = __ENV.PRODUCT_ID;
const VARIANT_ID = __ENV.VARIANT_ID;
const PAYMENT_METHOD_ID = __ENV.PAYMENT_METHOD_ID;
const SHIPPING_METHOD_ID = __ENV.SHIPPING_METHOD_ID;

export default function () {
  if (!STORE_ID || !PRODUCT_ID || !VARIANT_ID || !PAYMENT_METHOD_ID || !SHIPPING_METHOD_ID || !COOKIE) {
    throw new Error('Required env: AUTH_COOKIE, STORE_ID, PRODUCT_ID, VARIANT_ID, PAYMENT_METHOD_ID, SHIPPING_METHOD_ID');
  }
  const payload = JSON.stringify({
    storeId: STORE_ID,
    paymentMethodId: PAYMENT_METHOD_ID,
    shippingMethodId: SHIPPING_METHOD_ID,
    items: [{ productId: PRODUCT_ID, variantId: VARIANT_ID, quantity: 1 }],
    deliveryAddress: { city: 'load-test' },
    customerNote: 'k6 checkout concurrency test'
  });
  const res = http.post(`${BASE_URL}/api/orders`, payload, {
    headers: { 'Content-Type': 'application/json', 'Cookie': COOKIE, 'Idempotency-Key': `k6-${__VU}-${__ITER}-${Date.now()}` }
  });
  check(res, { 'checkout not 500': (r) => r.status < 500, 'checkout known status': (r) => [200, 201, 400, 401, 403, 409, 422, 429].includes(r.status) });
  sleep(1);
}
