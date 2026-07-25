import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const migrationsDir = path.resolve("drizzle");
const journalPath = path.join(migrationsDir, "meta", "_journal.json");
const journal = JSON.parse(await readFile(journalPath, "utf8"));
const sqlFiles = (await readdir(migrationsDir))
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort();
const files = sqlFiles.map((file) => file.replace(/\.sql$/, ""));
const entries = journal.entries || [];
const tags = entries.map((entry) => entry.tag);
const duplicateTags = tags.filter((tag, index) => tags.indexOf(tag) !== index);
const missingFromJournal = files.filter((file) => !tags.includes(file));
const missingSqlFiles = tags.filter((tag) => !files.includes(tag));
const malformedIndexes = entries.filter((entry, index) => entry.idx !== index);

// drizzle-orm/postgres-js runs the pending migration batch in a transaction.
// Keep operations PostgreSQL forbids inside a transaction out of the managed
// migration history; perform them separately with an audited operator runbook.
const transactionUnsafePatterns = [
  /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i,
  /\bDROP\s+INDEX\s+CONCURRENTLY\b/i,
  /\bREINDEX(?:\s+\w+)*\s+CONCURRENTLY\b/i,
  /\bVACUUM\b/i,
  /\b(?:CREATE|DROP)\s+DATABASE\b/i,
  /\b(?:CREATE|DROP)\s+TABLESPACE\b/i,
  /\bCLUSTER\b/i
];
const transactionUnsafeMigrations = [];
for (const file of sqlFiles) {
  const source = await readFile(path.join(migrationsDir, file), "utf8");
  const executableSql = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
  const matches = transactionUnsafePatterns.filter((pattern) => pattern.test(executableSql)).map((pattern) => pattern.source);
  if (matches.length) transactionUnsafeMigrations.push({ file, matches });
}

if (duplicateTags.length || missingFromJournal.length || missingSqlFiles.length || malformedIndexes.length || transactionUnsafeMigrations.length || files.length !== tags.length) {
  console.error(JSON.stringify({
    ok: false,
    duplicateTags: [...new Set(duplicateTags)],
    missingFromJournal,
    missingSqlFiles,
    malformedIndexes: malformedIndexes.map((entry) => ({ tag: entry.tag, idx: entry.idx })),
    transactionUnsafeMigrations,
    sqlFiles: files.length,
    journalEntries: tags.length
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, sqlFiles: files.length, journalEntries: tags.length, lastMigration: tags.at(-1) }, null, 2));
