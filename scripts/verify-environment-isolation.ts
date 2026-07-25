import "dotenv/config";
import { getEnvironmentIsolationReport, normalizeApplicationEnvironment } from "@/lib/environment/isolation";

const expectedArgument = process.argv.find((arg) => arg.startsWith("--expected="))?.slice("--expected=".length);
const expected = expectedArgument ? normalizeApplicationEnvironment(expectedArgument) : null;
const strict = process.argv.includes("--strict") || process.env.ENVIRONMENT_ISOLATION_ENFORCED === "true";
const report = getEnvironmentIsolationReport();
const expectedMatches = !expected || report.environment === expected;
const output = {
  environment: report.environment,
  expectedEnvironment: expected,
  enforced: report.enforced,
  expectedMatches,
  ok: expectedMatches && (!strict || report.ok),
  checks: report.checks.map(({ key, ok, message }) => ({ key, ok, message }))
};

console.log(JSON.stringify(output, null, 2));
if (!output.ok) process.exitCode = 1;
