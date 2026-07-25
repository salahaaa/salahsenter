#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const roots = ["app", "components"];
const extensions = new Set([".tsx", ".ts"]);
const findings = { files: 0, clientComponents: 0, directFetchCalls: 0, nativeDialogs: [], imagesMissingAlt: [], inputsWithoutIdentity: [] };

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (extensions.has(path.extname(entry.name))) inspect(full);
  }
}

function inspect(file) {
  const source = fs.readFileSync(file, "utf8");
  findings.files += 1;
  if (/^["']use client["'];/m.test(source)) findings.clientComponents += 1;
  findings.directFetchCalls += (source.match(/\bfetch\s*\(/g) || []).length;
  for (const match of source.matchAll(/window\.(?:confirm|alert|prompt)\s*\(/g)) findings.nativeDialogs.push({ file, offset: match.index });
  for (const match of source.matchAll(/<img\b[^>]*>/g)) {
    const tag = match[0];
    if (!/\balt\s*=/.test(tag) && !/aria-hidden\s*=\s*["']true["']/.test(tag)) findings.imagesMissingAlt.push({ file, tag: tag.slice(0, 180) });
  }
  for (const match of source.matchAll(/<input\b[^>]*>/g)) {
    const tag = match[0];
    if (!/\b(?:id|name|aria-label|aria-labelledby)\s*=/.test(tag)) findings.inputsWithoutIdentity.push({ file, tag: tag.slice(0, 180) });
  }
}

roots.forEach(walk);
const summary = {
  scannedFiles: findings.files,
  clientComponents: findings.clientComponents,
  directFetchCalls: findings.directFetchCalls,
  nativeDialogCalls: findings.nativeDialogs.length,
  imagesMissingAlt: findings.imagesMissingAlt.length,
  inputsWithoutIdentity: findings.inputsWithoutIdentity.length,
  samples: {
    nativeDialogs: findings.nativeDialogs.slice(0, 20),
    imagesMissingAlt: findings.imagesMissingAlt.slice(0, 20),
    inputsWithoutIdentity: findings.inputsWithoutIdentity.slice(0, 20)
  }
};
console.log(JSON.stringify(summary, null, 2));
if (process.argv.includes("--strict") && (summary.imagesMissingAlt || summary.inputsWithoutIdentity)) process.exitCode = 1;
