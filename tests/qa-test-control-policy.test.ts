import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { QA_TEST_CATALOG, QA_TEST_STATUSES, findQaTestCase } from "@/lib/qa/test-catalog";

const route = readFileSync("app/api/qa/test-runs/route.ts", "utf8");
const migration = readFileSync("drizzle/0088_qa_test_runs_evidence_registry.sql", "utf8");
const adminPage = readFileSync("app/admin/test-control/page.tsx", "utf8");
const testerPage = readFileSync("app/test-evidence/page.tsx", "utf8");

describe("team test control centre", () => {
  it("contains evidence cases for the requested quality, payment, ERP and performance tracks", () => {
    expect(QA_TEST_CATALOG.some((item) => item.key === "A11Y-01")).toBe(true);
    expect(QA_TEST_CATALOG.some((item) => item.key === "TEXT-01")).toBe(true);
    expect(QA_TEST_CATALOG.some((item) => item.key === "PAYMENT-02")).toBe(true);
    expect(QA_TEST_CATALOG.some((item) => item.key === "ERP-01")).toBe(true);
    expect(QA_TEST_CATALOG.some((item) => item.key === "PERF-01")).toBe(true);
    expect(QA_TEST_STATUSES).toContain("blocked");
    expect(findQaTestCase("RBAC-01")?.severity).toBe("critical");
  });

  it("keeps execution evidence isolated to a QA account or super administrator", () => {
    expect(route).toContain("user?.isTestAccount");
    expect(route).toContain('hasRole(session, "super_admin")');
    expect(route).toContain("actor.admin ? undefined : eq(qaTestRuns.executorUserId, actor.session.userId)");
    expect(route).toContain("رابط الدليل يجب أن يستخدم HTTPS");
  });

  it("uses a durable migration and separate tester/admin views", () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "qa_test_runs"');
    expect(migration).toContain("qa_test_runs_status_check");
    expect(adminPage).toContain("مركز اختبارات الفريق والأدلة");
    expect(testerPage).toContain("دليل اختبار الفريق");
  });
});
