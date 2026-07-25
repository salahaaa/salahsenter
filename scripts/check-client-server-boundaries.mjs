#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { builtinModules } from "node:module";

const root = process.cwd();
const sourceRoots = ["app", "components"];
const extensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const nodeBuiltins = new Set(builtinModules.flatMap((item) => [item, `node:${item}`]));
const forbiddenRuntimeSpecifiers = new Set([
  "next/headers",
  "next/server",
  "next/cache",
  "next/after",
  "postgres",
  "drizzle-orm/postgres-js",
  "@/lib/db",
  "@/lib/db/index",
  "@/lib/backup",
  "@/lib/backup-storage",
  "@/lib/private-documents-storage"
]);

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : extensions.includes(path.extname(entry.name)) ? [full] : [];
  });
}

function hasUseClient(source) {
  return /^\s*["']use client["'];?/m.test(source);
}

function runtimeImports(source) {
  const values = [];
  const add = (specifier, typeOnly = false) => values.push({ specifier, typeOnly });
  for (const match of source.matchAll(/\bimport\s+(type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["']/g)) add(match[2], Boolean(match[1]));
  for (const match of source.matchAll(/\bexport\s+(type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["']/g)) add(match[2], Boolean(match[1]));
  for (const match of source.matchAll(/\bimport\s*["']([^"']+)["']/g)) add(match[1], false);
  for (const match of source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) add(match[1], false);
  return values.filter((item, index, list) => !item.typeOnly && list.findIndex((candidate) => candidate.specifier === item.specifier && candidate.typeOnly === item.typeOnly) === index);
}

function resolveProjectImport(fromFile, specifier) {
  let base = "";
  if (specifier.startsWith("@/")) base = path.join(root, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(fromFile), specifier);
  else return null;

  const candidates = [base, ...extensions.map((extension) => `${base}${extension}`), ...extensions.map((extension) => path.join(base, `index${extension}`))];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function isForbiddenSpecifier(specifier) {
  if (nodeBuiltins.has(specifier)) return true;
  if (forbiddenRuntimeSpecifiers.has(specifier)) return true;
  return specifier.startsWith("@/lib/db/") || specifier.startsWith("@/lib/backup/") || specifier.startsWith("@/lib/redis/");
}

const entries = sourceRoots.flatMap((directory) => walk(path.join(root, directory))).filter((file) => hasUseClient(fs.readFileSync(file, "utf8")));
const failures = [];

for (const entry of entries) {
  const visited = new Set();
  const visit = (file, chain) => {
    const resolved = path.resolve(file);
    if (visited.has(resolved)) return;
    visited.add(resolved);
    const source = fs.readFileSync(resolved, "utf8");
    if (/^[\s"']*use server["'];?/m.test(source)) {
      failures.push({ entry, chain, reason: "client graph reaches a use server module" });
      return;
    }
    if (/\bimport\s+["']server-only["']/.test(source)) {
      failures.push({ entry, chain, reason: "client graph reaches a server-only module" });
      return;
    }
    for (const item of runtimeImports(source)) {
      if (isForbiddenSpecifier(item.specifier)) {
        failures.push({ entry, chain: [...chain, item.specifier], reason: `forbidden server runtime import: ${item.specifier}` });
        continue;
      }
      const dependency = resolveProjectImport(resolved, item.specifier);
      if (dependency) visit(dependency, [...chain, path.relative(root, dependency)]);
    }
  };
  visit(entry, [path.relative(root, entry)]);
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, clientEntries: entries.length, failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, clientEntries: entries.length, message: "No client component import graph reaches Node/server-only runtime modules." }, null, 2));
}
