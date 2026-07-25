#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve(".next", "static", "chunks");
const budgetKb = Number(process.env.PERFORMANCE_BUDGET_JS_KB || 350);
const totalBudgetKb = Number(process.env.PERFORMANCE_BUDGET_TOTAL_JS_KB || 1500);
const enforce = process.argv.includes("--enforce") || process.env.PERFORMANCE_BUDGET_ENFORCE === "true";

function files(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}

const javascript = files(root).filter((file) => file.endsWith(".js"));
if (!javascript.length) {
  console.error("No .next/static/chunks JS files found. Run next build before bundle analysis.");
  process.exitCode = 1;
} else {
  const chunks = javascript.map((file) => ({ file: path.relative(process.cwd(), file), gzipBytes: zlib.gzipSync(fs.readFileSync(file)).byteLength })).sort((a, b) => b.gzipBytes - a.gzipBytes);
  const total = chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0);
  const oversized = chunks.filter((chunk) => chunk.gzipBytes > budgetKb * 1024);
  const report = { budgetKb, totalBudgetKb, totalGzipKb: Number((total / 1024).toFixed(1)), chunks: chunks.slice(0, 30).map((chunk) => ({ ...chunk, gzipKb: Number((chunk.gzipBytes / 1024).toFixed(1)) })), oversized: oversized.map((chunk) => chunk.file), enforce };
  console.log(JSON.stringify(report, null, 2));
  if (enforce && (oversized.length || total > totalBudgetKb * 1024)) process.exitCode = 1;
}
