#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "config", "update-channel-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const requiredTools = [
  "tools/Apply-Mall-Update.ps1",
  "tools/Apply-Mall-Update.cmd",
  "tools/Initialize-Mall-Update-Channel.ps1",
  "tools/Initialize-Mall-Update-Channel.cmd",
  "tools/Verify-Mall-Project.ps1",
  "tools/Verify-Mall-Project.cmd"
];
const failures = [];

for (const file of [...manifest.requiredFiles, ...requiredTools]) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing update-channel file: ${file}`);
}
if (!manifest.sourceDirectories.includes("tools")) failures.push("Update manifest must synchronize tools directory.");
if (!manifest.sourceDirectories.includes("config")) failures.push("Update manifest must synchronize config directory.");

const updater = fs.readFileSync(path.join(root, "tools", "Apply-Mall-Update.ps1"), "utf8");
for (const required of ["Get-FileHash", "Expand-Archive", "release:verify:source", "backup/staging-before-update", "git", "origin", "staging"]) {
  if (!updater.includes(required)) failures.push(`Updater safety capability missing: ${required}`);
}
for (const forbidden of ["db:migrate", "db:push", "db:seed", "vercel --prod", "git push --force"]) {
  if (updater.toLowerCase().includes(forbidden.toLowerCase())) failures.push(`Updater must not run: ${forbidden}`);
}

const result = { ok: failures.length === 0, channel: manifest.channel, sourceDirectories: manifest.sourceDirectories, failures };
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
