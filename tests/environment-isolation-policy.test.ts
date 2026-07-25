import { afterEach, describe, expect, it } from "vitest";
import {
  assertEnvironmentIsolation,
  environmentNamespace,
  getEnvironmentIsolationReport,
  resolveApplicationEnvironment
} from "@/lib/environment/isolation";
import { namespaceRedisKey } from "@/lib/redis/client";

const originalPrefix = process.env.REDIS_KEY_PREFIX;
afterEach(() => {
  if (originalPrefix === undefined) delete process.env.REDIS_KEY_PREFIX;
  else process.env.REDIS_KEY_PREFIX = originalPrefix;
});

function stagingEnvironment(overrides: Record<string, string | undefined> = {}) {
  return {
    APP_ENV: "staging",
    NEXT_PUBLIC_APP_ENV: "staging",
    ENVIRONMENT_ISOLATION_ENFORCED: "true",
    RUNTIME_ENVIRONMENT: "staging",
    RESOURCE_NAMESPACE: "mall-os:staging",
    REDIS_KEY_PREFIX: "mall-os:staging:",
    NEXT_PUBLIC_APP_URL: "https://staging.example.test",
    ENVIRONMENT_PUBLIC_HOST: "staging.example.test",
    CLOUDINARY_FOLDER: "staging",
    PRIVATE_DOCUMENTS_R2_BUCKET: "mall-os-staging-private-documents",
    PRIVATE_DOCUMENTS_R2_PREFIX: "staging/legal-documents",
    BACKUP_S3_BUCKET: "mall-os-staging-backups",
    BACKUP_S3_PREFIX: "staging/database",
    PAYMENT_ENVIRONMENT: "sandbox",
    ERP_ENVIRONMENT: "sandbox",
    OUTBOUND_DELIVERY_MODE: "sandbox",
    ...overrides
  };
}

describe("environment isolation contract", () => {
  it("accepts a fully namespaced Staging configuration", () => {
    const report = getEnvironmentIsolationReport(stagingEnvironment());
    expect(report.environment).toBe("staging");
    expect(report.enforced).toBe(true);
    expect(report.ok).toBe(true);
    expect(() => assertEnvironmentIsolation(stagingEnvironment())).not.toThrow();
  });

  it("blocks mixed Production resource names or live payment settings in Staging", () => {
    const report = getEnvironmentIsolationReport(stagingEnvironment({
      PRIVATE_DOCUMENTS_R2_BUCKET: "mall-os-production-private-documents",
      PAYMENT_ENVIRONMENT: "live"
    }));
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.key === "Private R2 documents")?.ok).toBe(false);
    expect(report.checks.find((check) => check.key === "Payment sandbox")?.ok).toBe(false);
    expect(() => assertEnvironmentIsolation(stagingEnvironment({ PAYMENT_ENVIRONMENT: "live" }))).toThrow(/staging/i);
  });

  it("keeps local development usable without pretending it is an isolated runtime", () => {
    const report = getEnvironmentIsolationReport({ APP_ENV: "development", NEXT_PUBLIC_APP_ENV: "development" });
    expect(report.ok).toBe(true);
    expect(resolveApplicationEnvironment({ VERCEL_ENV: "production" })).toBe("production");
    expect(environmentNamespace("production")).toBe("mall-os:production");
  });

  it("prefixes application Redis keys so cache and rate limits cannot collide across environments", () => {
    process.env.REDIS_KEY_PREFIX = "mall-os:staging:";
    expect(namespaceRedisKey("cache:home")).toBe("mall-os:staging:cache:home");
    expect(namespaceRedisKey("mall-os:staging:cache:home")).toBe("mall-os:staging:cache:home");
  });
});
