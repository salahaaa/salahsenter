#!/usr/bin/env node
import { performance } from 'node:perf_hooks';

const BASE_URL = (process.env.BASE_URL || 'https://salahsentar22.vercel.app').replace(/\/$/, '');
const DURATION_MS = Number(process.env.DURATION_MS || 30000);
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 15000);

const endpoints = [
  { name: 'homepage', method: 'GET', path: '/' },
  { name: 'offers', method: 'GET', path: '/offers' },
  { name: 'wings', method: 'GET', path: '/wings' },
  { name: 'track_order', method: 'GET', path: '/track-order' },
  { name: 'smart_search_electronics', method: 'GET', path: '/api/search/smart?q=%D8%A7%D9%84%D8%A5%D9%84%D9%83%D8%AA%D8%B1%D9%88%D9%86%D9%8A%D8%A7%D8%AA' },
  { name: 'advanced_search_electronics', method: 'GET', path: '/api/search/advanced?q=%D8%A7%D9%84%D8%A5%D9%84%D9%83%D8%AA%D8%B1%D9%88%D9%86%D9%8A%D8%A7%D8%AA&limit=12&source=probe' },
  { name: 'health', method: 'GET', path: '/api/health' }
];

const stats = new Map(endpoints.map((e) => [e.name, { latencies: [], errors: 0, statuses: new Map(), bytes: 0 }]));
let total = 0;
let stopped = false;

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[idx].toFixed(1));
}

async function once(endpoint) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();
  try {
    const res = await fetch(`${BASE_URL}${endpoint.path}`, { method: endpoint.method, signal: controller.signal, headers: { 'user-agent': 'enterprise-readiness-probe/1.0' } });
    const body = await res.arrayBuffer();
    const elapsed = performance.now() - started;
    const item = stats.get(endpoint.name);
    item.latencies.push(elapsed);
    item.bytes += body.byteLength;
    item.statuses.set(res.status, (item.statuses.get(res.status) || 0) + 1);
    if (res.status >= 500) item.errors += 1;
  } catch {
    const elapsed = performance.now() - started;
    const item = stats.get(endpoint.name);
    item.latencies.push(elapsed);
    item.errors += 1;
    item.statuses.set('ERR', (item.statuses.get('ERR') || 0) + 1);
  } finally {
    clearTimeout(timer);
    total += 1;
  }
}

async function worker(id) {
  while (!stopped) {
    const endpoint = endpoints[(id + total) % endpoints.length];
    await once(endpoint);
  }
}

const started = performance.now();
setTimeout(() => { stopped = true; }, DURATION_MS);
await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
const elapsedSeconds = (performance.now() - started) / 1000;

const result = {
  baseUrl: BASE_URL,
  durationSeconds: Number(elapsedSeconds.toFixed(1)),
  concurrency: CONCURRENCY,
  totalRequests: total,
  throughputRps: Number((total / elapsedSeconds).toFixed(2)),
  endpoints: Object.fromEntries([...stats.entries()].map(([name, item]) => {
    const count = item.latencies.length;
    return [name, {
      count,
      errorRate: count ? Number((item.errors / count).toFixed(4)) : 0,
      statuses: Object.fromEntries([...item.statuses.entries()].map(([k, v]) => [String(k), v])),
      p50: percentile(item.latencies, 50),
      p95: percentile(item.latencies, 95),
      p99: percentile(item.latencies, 99),
      max: item.latencies.length ? Number(Math.max(...item.latencies).toFixed(1)) : null,
      avgBytes: count ? Math.round(item.bytes / count) : 0
    }];
  }))
};

console.log(JSON.stringify(result, null, 2));
