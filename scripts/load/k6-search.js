import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    search_smoke: { executor: 'ramping-vus', stages: [{ duration: '30s', target: 20 }, { duration: '1m', target: 50 }, { duration: '30s', target: 0 }] }
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<800']
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const queries = (__ENV.SEARCH_QUERIES || 'حذاء,جوال,عروض,مطعم,ملابس,لابتوب').split(',');

export default function () {
  const q = queries[Math.floor(Math.random() * queries.length)];
  const res = http.get(`${BASE_URL}/api/search/advanced?q=${encodeURIComponent(q)}&limit=8&source=load_test`);
  check(res, { 'search 200': (r) => r.status === 200, 'search success': (r) => !!r.json('success') });
  sleep(Math.random() * 1.5);
}
