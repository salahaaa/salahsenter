#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  })
);

const hours = Number(args.hours || 24);
const sinceArg = args.since ? new Date(String(args.since)) : null;
const cutoff = sinceArg && Number.isFinite(sinceArg.getTime()) ? sinceArg : new Date(Date.now() - hours * 60 * 60 * 1000);
const outRoot = path.resolve(root, String(args.out || "updates"));
const mode = String(args.mode || "auto");

const excludedDirs = new Set([
  ".git",
  ".next",
  ".npm",
  ".cache",
  ".local",
  ".venv",
  "node_modules",
  "coverage",
  "dist",
  "build",
  "uploads",
  "tmp",
  "backups",
  "updates",
  "__pycache__"
]);

const excludedFiles = new Set([
  "tsconfig.tsbuildinfo",
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".env.staging",
  ".env.test"
]);

function rel(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, "/");
}

function isExcluded(relativePath) {
  const parts = relativePath.split("/");
  if (parts.some((part) => excludedDirs.has(part))) return true;
  if (excludedFiles.has(parts.at(-1) || "")) return true;
  if (relativePath.startsWith("public/uploads/")) return true;
  if (relativePath.endsWith(".log")) return true;
  return false;
}

function walk(dir, list = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const relativePath = rel(full);
    if (isExcluded(relativePath)) continue;
    const st = statSync(full);
    if (st.isDirectory()) walk(full, list);
    else if (st.isFile() && st.mtime >= cutoff) list.push(relativePath);
  }
  return list;
}

function gitAvailable() {
  return existsSync(path.join(root, ".git"));
}

function runGit(argsList) {
  return execFileSync("git", argsList, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function gitFilesSince() {
  const files = new Set();
  try {
    const sinceIso = cutoff.toISOString();
    const committed = runGit(["log", `--since=${sinceIso}`, "--name-only", "--pretty=format:"])
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const file of committed) files.add(file);

    const changed = runGit(["diff", "--name-only", "HEAD"])
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const file of changed) files.add(file);

    const staged = runGit(["diff", "--cached", "--name-only"])
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const file of staged) files.add(file);

    const untracked = runGit(["ls-files", "--others", "--exclude-standard"])
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const file of untracked) {
      try {
        if (statSync(path.join(root, file)).mtime >= cutoff) files.add(file);
      } catch {
        // ignore deleted untracked file race
      }
    }
  } catch {
    return [];
  }
  return [...files].filter((file) => existsSync(path.join(root, file)) && !isExcluded(file)).sort();
}

function collectFiles() {
  if ((mode === "auto" || mode === "git") && gitAvailable()) {
    const files = gitFilesSince();
    if (files.length || mode === "git") return { files, source: "git" };
  }
  return { files: walk(root).sort(), source: "mtime" };
}

const { files, source } = collectFiles();
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const bundleDir = path.join(outRoot, `update-${stamp}`);
const filesDir = path.join(bundleDir, "files");
mkdirSync(filesDir, { recursive: true });

for (const file of files) {
  const src = path.join(root, file);
  const dest = path.join(filesDir, file);
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

const manifest = `# حزمة الملفات المحدثة فقط\n\n` +
  `Generated at: ${new Date().toISOString()}\n\n` +
  `Detection source: ${source}\n\n` +
  `Cutoff: ${cutoff.toISOString()}\n\n` +
  `Files count: ${files.length}\n\n` +
  `## طريقة الاستخدام\n\n` +
  `انسخ محتويات مجلد \`files\` فوق مشروعك القديم مع اختيار Replace للملفات الموجودة فقط. لا تنس تشغيل الفحص بعد النسخ.\n\n` +
  `## الملفات\n\n` +
  (files.length ? files.map((file) => `- ${file}`).join("\n") : "لا توجد ملفات مطابقة.") +
  `\n`;

writeFileSync(path.join(bundleDir, "manifest.md"), manifest, "utf8");
writeFileSync(path.join(bundleDir, "files.txt"), files.join("\n") + (files.length ? "\n" : ""), "utf8");

console.log(`✅ تم إنشاء حزمة التحديث: ${path.relative(root, bundleDir)}`);
console.log(`📄 عدد الملفات: ${files.length}`);
console.log(`📌 المصدر: ${source}`);
console.log(`📌 منذ: ${cutoff.toISOString()}`);
if (files.length) console.log(files.join("\n"));
