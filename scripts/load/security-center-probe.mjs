#!/usr/bin/env node
const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const COOKIE = process.env.AUTH_COOKIE || "";
const CSRF = process.env.CSRF_TOKEN || "";
const ITERATIONS = Number(process.env.ITERATIONS || 20);

async function hit(path, options = {}) {
  const started = performance.now();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      cookie: COOKIE,
      ...(CSRF ? { "x-csrf-token": CSRF, "x-requested-with": "XMLHttpRequest" } : {}),
      ...(options.headers || {})
    }
  });
  const ms = Math.round(performance.now() - started);
  const text = await response.text();
  return { path, ok: response.ok, status: response.status, ms, bytes: text.length };
}

const results = [];
for (let i = 0; i < ITERATIONS; i += 1) {
  results.push(await hit("/api/admin/security/center"));
}
const sorted = results.map((r) => r.ms).sort((a, b) => a - b);
const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] || 0;
console.table(results);
console.log(JSON.stringify({
  iterations: ITERATIONS,
  ok: results.filter((r) => r.ok).length,
  failed: results.filter((r) => !r.ok).length,
  avgMs: Math.round(results.reduce((sum, r) => sum + r.ms, 0) / results.length),
  p95Ms: percentile(95),
  maxMs: sorted[sorted.length - 1] || 0
}, null, 2));
process.exit(results.some((r) => !r.ok) ? 1 : 0);
