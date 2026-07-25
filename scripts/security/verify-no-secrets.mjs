import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Deliberately report only locations/commits, never a matched value.
// Keep this compatible with git grep's ERE engine as it also scans all history.
const secretPattern = "sk_(live|test)_[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z_-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----";
const secretRegex = new RegExp(secretPattern, "g");
const trackedEnvPattern = /(^|\/)\.env(?:\.|$)/;

function git(args, allowNoMatch = false) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    if (allowNoMatch && error && typeof error === "object" && "status" in error && error.status === 1) return "";
    throw error;
  }
}

const failures = [];
if (git(["rev-parse", "--is-shallow-repository"]).trim() === "true") {
  throw new Error("Secret history verification requires a full Git history. Configure checkout with fetch-depth: 0.");
}
const trackedFiles = git(["ls-files", "-z"]).split("\0").filter(Boolean);
for (const file of trackedFiles) {
  if (trackedEnvPattern.test(file) && !file.endsWith(".example")) failures.push({ type: "tracked_environment_file", file });
  try {
    const content = readFileSync(file, "utf8");
    if (secretRegex.test(content)) failures.push({ type: "secret_pattern_in_head", file });
    secretRegex.lastIndex = 0;
  } catch {
    // Binary files are intentionally ignored by this text-secret pattern scan.
  }
}

const commits = git(["rev-list", "--all"]).trim().split("\n").filter(Boolean);
for (const commit of commits) {
  // git grep scans the snapshot without materialising a potentially huge diff.
  const matchedFiles = git(["grep", "-Il", "-E", secretPattern, commit], true).trim().split("\n").filter(Boolean);
  if (matchedFiles.length) failures.push({ type: "secret_pattern_in_history", commit: commit.slice(0, 12), files: matchedFiles });
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, trackedFiles: trackedFiles.length, commitsScanned: commits.length, message: "No known live-key/private-key patterns or tracked runtime .env files found." }, null, 2));
