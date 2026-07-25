import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/$/, '');
const TOKEN = __ENV.INTEGRATION_TOKEN || '';
const CLIENT_ID = __ENV.INTEGRATION_CLIENT_ID || '';
if (__ENV.LOAD_TEST_CONFIRM !== 'true' || !BASE_URL || !TOKEN || !CLIENT_ID || __ENV.APP_ENV === 'production') {
  throw new Error('ERP load test requires LOAD_TEST_CONFIRM=true, APP_ENV=staging, BASE_URL, INTEGRATION_TOKEN and INTEGRATION_CLIENT_ID.');
}

export const options = {
  scenarios: {
    erp_reads: { executor: 'constant-arrival-rate', rate: Number(__ENV.ERP_READ_RATE || 15), timeUnit: '1s', duration: __ENV.ERP_DURATION || '3m', preAllocatedVUs: 20, maxVUs: 100, exec: 'read' },
    erp_health: { executor: 'constant-arrival-rate', rate: Number(__ENV.ERP_HEALTH_RATE || 3), timeUnit: '1s', duration: __ENV.ERP_DURATION || '3m', preAllocatedVUs: 5, maxVUs: 30, exec: 'health' }
  },
  thresholds: {
    http_req_failed: ['rate<0.03'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    erp_5xx_rate: ['rate<0.01']
  }
};

export const erpLatency = new Trend('erp_api_latency_ms');
export const erp5xxRate = new Rate('erp_5xx_rate');
export const erpKnownResponses = new Counter('erp_known_responses');

function params() {
  return { headers: { Authorization: `Bearer ${TOKEN}`, 'x-integration-client-id': CLIENT_ID } };
}

function known(status) {
  return [200, 401, 403, 404, 409, 422, 429].includes(status);
}

export function read() {
  const store = __ENV.STORE_ID ? `?storeId=${encodeURIComponent(__ENV.STORE_ID)}` : '';
  const response = http.batch([
    ['GET', `${BASE_URL}/api/integrations/products${store}`, null, params()],
    ['GET', `${BASE_URL}/api/integrations/orders${store}`, null, params()],
    ['GET', `${BASE_URL}/api/integrations/events`, null, params()]
  ]);
  for (const item of response) {
    erpLatency.add(item.timings.duration);
    erp5xxRate.add(item.status >= 500);
    if (known(item.status)) erpKnownResponses.add(1);
    check(item, { 'ERP endpoint no 5xx': (r) => r.status < 500, 'ERP endpoint known response': (r) => known(r.status) });
  }
  sleep(Math.random());
}

export function health() {
  const response = http.get(`${BASE_URL}/api/integrations/health`, params());
  erpLatency.add(response.timings.duration);
  erp5xxRate.add(response.status >= 500);
  check(response, { 'ERP health no 5xx': (r) => r.status < 500, 'ERP health known response': (r) => known(r.status) });
  sleep(1);
}
