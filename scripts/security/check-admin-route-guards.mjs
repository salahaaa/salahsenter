#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "app", "api", "admin");
const missing = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === "route.ts") {
      const source = fs.readFileSync(full, "utf8");
      const hasSession = /\brequireAuth\s*\(/.test(source);
      const hasAdminGuard = /\bassertAdmin(?:Operation|EmployeeAction)?\s*\(/.test(source);
      if (!hasSession || !hasAdminGuard) missing.push(path.relative(process.cwd(), full));
    }
  }
}
walk(root);
const result = { ok: missing.length === 0, scannedRoot: "app/api/admin", missing };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
