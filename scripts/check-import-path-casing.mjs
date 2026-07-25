#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const roots = ["app", "components", "lib", "scripts", "tests"];
const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];
const ignored = new Set(["node_modules", ".git", ".next", "coverage", "dist", "build", "out"]);
const imports = /(?:from\s*|import\s*\()\s*["']([^"']+)["']/g;

function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignored.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, files);
    else if (sourceExtensions.includes(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

function resolveCaseInsensitive(candidate) {
  const parsed = path.parse(candidate);
  let current = parsed.root || path.sep;
  const segments = candidate.slice(parsed.root.length).split(path.sep).filter(Boolean);
  const mismatches = [];
  for (const segment of segments) {
    if (!fs.existsSync(current) || !fs.statSync(current).isDirectory()) return null;
    const entries = fs.readdirSync(current);
    const exact = entries.find((entry) => entry === segment);
    const match = exact || entries.find((entry) => entry.toLowerCase() === segment.toLowerCase());
    if (!match) return null;
    if (match !== segment) mismatches.push({ expected: segment, actual: match, directory: current });
    current = path.join(current, match);
  }
  return { resolved: current, mismatches };
}

function resolveImport(sourceFile, specifier) {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return null;
  const base = specifier.startsWith("@/")
    ? path.join(root, specifier.slice(2))
    : path.resolve(path.dirname(sourceFile), specifier);
  const candidates = path.extname(base)
    ? [base]
    : [...sourceExtensions.map((extension) => `${base}${extension}`), ...sourceExtensions.map((extension) => path.join(base, `index${extension}`))];
  for (const candidate of candidates) {
    const result = resolveCaseInsensitive(candidate);
    if (result && fs.existsSync(result.resolved) && fs.statSync(result.resolved).isFile()) return result;
  }
  return null;
}

const findings = [];
for (const file of roots.flatMap((directory) => walk(path.join(root, directory)))) {
  const content = fs.readFileSync(file, "utf8");
  for (const match of content.matchAll(imports)) {
    const specifier = match[1];
    const resolved = resolveImport(file, specifier);
    if (!resolved?.mismatches.length) continue;
    for (const mismatch of resolved.mismatches) findings.push({ file: path.relative(root, file), specifier, ...mismatch });
  }
}

if (findings.length) {
  console.error("❌ Import paths with incorrect letter case were found:");
  for (const item of findings) console.error(`- ${item.file}: ${item.specifier} uses '${item.expected}', actual disk name is '${item.actual}'`);
  process.exit(1);
}

console.log("✅ Import path casing matches filesystem names.");
