#!/usr/bin/env node
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const excludedDirectories = new Set([
  ".arena",
  ".cache",
  ".git",
  ".mypy_cache",
  ".next",
  ".nox",
  ".npm",
  ".nuxt",
  ".output",
  ".parcel-cache",
  ".pytest_cache",
  ".ruff_cache",
  ".svelte-kit",
  ".tox",
  ".turbo",
  ".venv",
  ".vite",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target"
]);

const excludedFilePatterns = [
  /^\.env$/,
  /^\.env\./,
  /\.zip$/i,
  /\.tsbuildinfo$/i
];

function isAsciiPath(path) {
  return /^[\x20-\x7E]+$/.test(path);
}

function hasUnsafeWhitespace(path) {
  return /\s/.test(path);
}

function shouldSkipFile(name) {
  return excludedFilePatterns.some((pattern) => pattern.test(name));
}

const unsafe = [];
const warnings = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    if (entry.isFile() && shouldSkipFile(entry.name)) continue;

    const absolutePath = join(directory, entry.name);
    const projectPath = relative(root, absolutePath).replaceAll("\\", "/");

    if (!isAsciiPath(projectPath)) unsafe.push(projectPath);
    if (hasUnsafeWhitespace(projectPath)) warnings.push(projectPath);

    if (entry.isDirectory()) walk(absolutePath);
    else if (entry.isSymbolicLink()) {
      try {
        const stat = statSync(absolutePath);
        if (stat.isDirectory()) walk(absolutePath);
      } catch {
        // Ignore broken symlinks in local environments.
      }
    }
  }
}

walk(root);

if (unsafe.length) {
  console.error("\n❌ تم العثور على أسماء ملفات/مجلدات غير ASCII وقد تسبب مشاكل عند الرفع إلى GitHub/Replit/Vercel:\n");
  for (const path of unsafe) console.error(`- ${path}`);
  console.error("\nالحل: أعد تسمية هذه الملفات أو المجلدات إلى أسماء إنجليزية مثل screenshots/home-page.png ثم أعد الفحص.\n");
  process.exit(1);
}

if (warnings.length) {
  console.warn("\n⚠️ تنبيه: توجد أسماء تحتوي مسافات. ليست مشكلة دائماً، لكن الأفضل استبدالها بشرطات - للرفع الآمن:\n");
  for (const path of warnings) console.warn(`- ${path}`);
}

console.log("✅ أسماء ملفات ومجلدات المشروع آمنة للرفع: ASCII فقط بدون أسماء عربية.");
