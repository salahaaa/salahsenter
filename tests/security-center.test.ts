import { describe, expect, it } from "vitest";
import { analyzeRootCause } from "@/lib/ai/security-root-cause";
import { gradeFromScore, scorePlatformHealth } from "@/lib/admin/platform-protection-center";

describe("admin platform protection center", () => {
  it("scores excellent systems with healthy services", () => {
    const score = scorePlatformHealth([
      { status: "operational", severity: "success" },
      { status: "operational", severity: "success" }
    ], { dbUsagePercent: 20, heapUsagePercent: 30, failedJobs: 0, criticalAlerts: 0, failedLogins1h: 0 });
    expect(score).toBe(100);
    expect(gradeFromScore(score)).toBe("Excellent");
  });

  it("downgrades critical services and pressure metrics", () => {
    const score = scorePlatformHealth([
      { status: "down", severity: "critical" },
      { status: "degraded", severity: "warning" }
    ], { dbUsagePercent: 80, heapUsagePercent: 90, failedJobs: 3, criticalAlerts: 1, failedLogins1h: 25 });
    expect(score).toBeLessThan(55);
    expect(gradeFromScore(score)).toBe("Critical");
  });

  it("classifies database root causes from stack traces", () => {
    const analysis = analyzeRootCause({
      service: "checkout",
      message: "PostgresError: too many connections while committing transaction",
      stackTrace: "at app/api/checkout/route.ts:42:10\nat lib/db/index.ts:12:1"
    });
    expect(analysis.category).toBe("database_failure");
    expect(analysis.affectedService).toBe("checkout");
    expect(analysis.expectedFile).toContain("app/api/checkout/route.ts");
    expect(analysis.confidence).toBeGreaterThan(0.85);
  });

  it("classifies suspicious security activity", () => {
    const analysis = analyzeRootCause({ message: "brute force suspicious IP activity and permission escalation attempt" });
    expect(analysis.category).toBe("security_threat");
    expect(analysis.severity).toBe("critical");
  });
});
