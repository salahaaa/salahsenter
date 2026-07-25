import "dotenv/config";
import { getProductionReadiness } from "@/lib/production/readiness";
import { client } from "@/lib/db";

const minScore = Number(process.env.PRODUCTION_READINESS_MIN_SCORE || process.argv.find((arg) => arg.startsWith("--min-score="))?.split("=")[1] || 90);
const strict = process.argv.includes("--strict") || process.env.PRODUCTION_READINESS_STRICT === "true";

try {
  const readiness = await getProductionReadiness();
  const failed = readiness.checks.filter((check) => !check.ok);
  const danger = failed.filter((check) => check.severity === "danger");
  const warn = failed.filter((check) => check.severity === "warn");

  console.log(JSON.stringify(readiness, null, 2));

  if (readiness.score < minScore) {
    console.error(`Production readiness score ${readiness.score}% is below required ${minScore}%`);
    process.exitCode = 1;
  }
  if (danger.length) {
    console.error(`Production readiness has ${danger.length} danger checks: ${danger.map((item) => item.label).join(", ")}`);
    process.exitCode = 1;
  }
  if (strict && warn.length) {
    console.error(`Production readiness strict mode has ${warn.length} warnings: ${warn.map((item) => item.label).join(", ")}`);
    process.exitCode = 1;
  }
} finally {
  await client.end({ timeout: 5 }).catch(() => undefined);
}
