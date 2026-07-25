import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

export const options = {
  scenarios: {
    homepage_traffic: { executor: 'ramping-vus', stages: [{ duration: '1m', target: Number(__ENV.HOME_VUS || 50) }, { duration: '3m', target: Number(__ENV.HOME_VUS || 50) }, { duration: '1m', target: 0 }], exec: 'homepageTraffic' },
    browsing_search: { executor: 'ramping-vus', stages: [{ duration: '1m', target: Number(__ENV.BROWSE_VUS || 40) }, { duration: '3m', target: Number(__ENV.BROWSE_VUS || 40) }, { duration: '1m', target: 0 }], exec: 'browseAndSearch', startTime: '10s' },
    api_concurrency: { executor: 'constant-arrival-rate', rate: Number(__ENV.API_RATE || 20), timeUnit: '1s', duration: __ENV.API_DURATION || '4m', preAllocatedVUs: Number(__ENV.API_PREALLOCATED_VUS || 40), maxVUs: Number(__ENV.API_MAX_VUS || 150), exec: 'apiConcurrency', startTime: '20s' },
    authenticated_dashboards: { executor: 'ramping-vus', stages: [{ duration: '1m', target: Number(__ENV.DASHBOARD_VUS || 10) }, { duration: '3m', target: Number(__ENV.DASHBOARD_VUS || 10) }, { duration: '1m', target: 0 }], exec: 'authenticatedDashboards', startTime: '30s' }
  },
  thresholds: {
    http_req_failed: ['rate<0.03'],
    http_req_duration: ['p(50)<500', 'p(95)<1500', 'p(99)<3000'],
    checkout_errors: ['rate<0.05'],
    inventory_conflicts: ['count>=0']
  }
};

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/$/, '');
if (__ENV.LOAD_TEST_CONFIRM !== 'true' || !BASE_URL || __ENV.APP_ENV === 'production') {
  throw new Error('Load tests require LOAD_TEST_CONFIRM=true, an explicit staging BASE_URL, and APP_ENV must not be production.');
}
const AUTH_COOKIE = __ENV.AUTH_COOKIE || '';
const ADMIN_COOKIE = __ENV.ADMIN_COOKIE || AUTH_COOKIE;
const MERCHANT_COOKIE = __ENV.MERCHANT_COOKIE || AUTH_COOKIE;
const queries = (__ENV.SEARCH_QUERIES || 'الإلكترونيات,ذهب,مطاعم,عروض,لابتوب,ملابس').split(',').map((s) => s.trim()).filter(Boolean);
const storeSlugs = (__ENV.STORE_SLUGS || '').split(',').map((s) => s.trim()).filter(Boolean);
const productPaths = (__ENV.PRODUCT_PATHS || '').split(',').map((s) => s.trim()).filter(Boolean);

export const checkoutLatency = new Trend('checkout_latency');
export const checkoutErrors = new Rate('checkout_errors');
export const inventoryConflicts = new Counter('inventory_conflicts');

function headers(cookie = '') {
  return cookie ? { headers: { Cookie: cookie, 'Content-Type': 'application/json' } } : { headers: { 'Content-Type': 'application/json' } };
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function statusKnown(res) {
  return [200, 201, 204, 301, 302, 307, 400, 401, 403, 404, 409, 422, 429].includes(res.status);
}

export function homepageTraffic() {
  group('homepage + public pages', () => {
    const home = http.get(`${BASE_URL}/`);
    check(home, { 'home status ok': (r) => r.status === 200, 'home body not empty': (r) => r.body && r.body.length > 1000 });
    const offers = http.get(`${BASE_URL}/offers`);
    check(offers, { 'offers status ok': (r) => r.status === 200 });
    const wings = http.get(`${BASE_URL}/wings`);
    check(wings, { 'wings status ok': (r) => r.status === 200 });
  });
  sleep(Math.random() * 2);
}

export function browseAndSearch() {
  group('search + product browsing', () => {
    const q = randomItem(queries);
    const smart = http.get(`${BASE_URL}/api/search/smart?q=${encodeURIComponent(q)}`);
    check(smart, { 'smart search 200': (r) => r.status === 200, 'smart search success': (r) => r.json('success') === true });
    const advanced = http.get(`${BASE_URL}/api/search/advanced?q=${encodeURIComponent(q)}&limit=12&source=k6`);
    check(advanced, { 'advanced search 200': (r) => r.status === 200 });
    if (storeSlugs.length) check(http.get(`${BASE_URL}/store/${randomItem(storeSlugs)}`), { 'store status known': statusKnown });
    if (productPaths.length) check(http.get(`${BASE_URL}${randomItem(productPaths)}`), { 'product status known': statusKnown });
  });
  sleep(Math.random() * 1.5);
}

export function apiConcurrency() {
  group('public API concurrency', () => {
    const q = randomItem(queries);
    const res = http.batch([
      ['GET', `${BASE_URL}/api/health`, null, headers()],
      ['GET', `${BASE_URL}/api/search/smart?q=${encodeURIComponent(q)}`, null, headers()],
      ['GET', `${BASE_URL}/api/search/home?q=${encodeURIComponent(q)}`, null, headers()]
    ]);
    check(res[0], { 'health status known': statusKnown });
    check(res[1], { 'smart status 200': (r) => r.status === 200 });
    check(res[2], { 'home search status known': statusKnown });
  });
}

export function authenticatedDashboards() {
  if (!AUTH_COOKIE && !ADMIN_COOKIE && !MERCHANT_COOKIE) return;
  group('authenticated dashboards', () => {
    if (MERCHANT_COOKIE) {
      check(http.get(`${BASE_URL}/merchant`, headers(MERCHANT_COOKIE)), { 'merchant dashboard not 5xx': (r) => r.status < 500 });
      check(http.get(`${BASE_URL}/merchant/orders`, headers(MERCHANT_COOKIE)), { 'merchant orders not 5xx': (r) => r.status < 500 });
    }
    if (ADMIN_COOKIE) {
      check(http.get(`${BASE_URL}/admin`, headers(ADMIN_COOKIE)), { 'admin dashboard not 5xx': (r) => r.status < 500 });
      check(http.get(`${BASE_URL}/admin/ads`, headers(ADMIN_COOKIE)), { 'admin ads not 5xx': (r) => r.status < 500 });
    }
  });
  sleep(1);
}

export function checkoutFlow() {
  if (!AUTH_COOKIE || !__ENV.STORE_ID || !__ENV.PRODUCT_ID || !__ENV.VARIANT_ID || !__ENV.PAYMENT_METHOD_ID || !__ENV.SHIPPING_METHOD_ID) return;
  const payload = JSON.stringify({
    storeId: __ENV.STORE_ID,
    paymentMethodId: __ENV.PAYMENT_METHOD_ID,
    shippingMethodId: __ENV.SHIPPING_METHOD_ID,
    currency: __ENV.CURRENCY || 'YER',
    items: [{ productId: __ENV.PRODUCT_ID, variantId: __ENV.VARIANT_ID, quantity: Number(__ENV.QUANTITY || 1) }],
    deliveryAddress: { city: 'k6-load-test', addressLine: 'k6-load-test' },
    customerNote: 'k6 enterprise checkout test'
  });
  const idempotencyKey = `k6-order-${__VU}-${__ITER}-${Date.now()}`;
  const res = http.post(`${BASE_URL}/api/orders`, payload, { headers: { Cookie: AUTH_COOKIE, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey } });
  checkoutLatency.add(res.timings.duration);
  checkoutErrors.add(res.status >= 500 || ![200, 201, 400, 409, 422, 429].includes(res.status));
  if (res.status === 409) inventoryConflicts.add(1);
  check(res, { 'checkout no 5xx': (r) => r.status < 500, 'checkout known response': (r) => [200, 201, 400, 409, 422, 429].includes(r.status) });
}
