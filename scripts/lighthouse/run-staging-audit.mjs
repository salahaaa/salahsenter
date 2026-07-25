#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import lighthouse from "lighthouse";
import chromeLauncher from "chrome-launcher";

const baseUrl = (process.env.LIGHTHOUSE_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || "").replace(/\/$/, "");
const outputDirectory = path.resolve(process.env.LIGHTHOUSE_OUTPUT_DIR || "artifacts/lighthouse");
const pages = (process.env.LIGHTHOUSE_PATHS || "/,/offers,/login")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean)
  .map((item) => item.startsWith("http") ? item : `${baseUrl}${item.startsWith("/") ? item : `/${item}`}`);
const limits = {
  performance: Number(process.env.LIGHTHOUSE_MIN_PERFORMANCE || 0.7),
  accessibility: Number(process.env.LIGHTHOUSE_MIN_ACCESSIBILITY || 0.9),
  "best-practices": Number(process.env.LIGHTHOUSE_MIN_BEST_PRACTICES || 0.9),
  seo: Number(process.env.LIGHTHOUSE_MIN_SEO || 0.9)
};

if (process.env.APP_ENV !== "staging" || !baseUrl || !/^https:\/\//.test(baseUrl)) {
  throw new Error("Lighthouse gate requires APP_ENV=staging and an explicit HTTPS LIGHTHOUSE_BASE_URL.");
}

await fs.mkdir(outputDirectory, { recursive: true });
const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless", "--no-sandbox", "--disable-dev-shm-usage"] });
const reports = [];

try {
  for (const url of pages) {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: ["html", "json"],
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
      logLevel: "error",
      throttlingMethod: "simulate"
    });
    if (!result?.lhr || !Array.isArray(result.report)) throw new Error(`Lighthouse did not return a report for ${url}`);
    const slug = new URL(url).pathname.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9_-]+/gi, "-") || "home";
    const [html, json] = result.report;
    await Promise.all([
      fs.writeFile(path.join(outputDirectory, `${slug}.html`), html),
      fs.writeFile(path.join(outputDirectory, `${slug}.json`), json)
    ]);
    const scores = Object.fromEntries(Object.entries(result.lhr.categories)
      .filter(([key]) => key in limits)
      .map(([key, value]) => [key, Number(value.score ?? 0)]));
    reports.push({ url, slug, scores, passed: Object.entries(limits).every(([category, minimum]) => scores[category] >= minimum) });
  }
} finally {
  await chrome.kill();
}

const summary = {
  environment: "staging",
  baseUrl,
  generatedAt: new Date().toISOString(),
  limits,
  reports,
  passed: reports.length > 0 && reports.every((report) => report.passed)
};
await fs.writeFile(path.join(outputDirectory, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (!summary.passed) process.exitCode = 1;
