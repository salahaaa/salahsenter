export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { hasRole, requireAuth } from "@/lib/auth";
import { db, qaTestRuns, users } from "@/lib/db";
import { findQaTestCase } from "@/lib/qa/test-catalog";

const submissionSchema = z.object({
  caseKey: z.string().trim().min(3).max(120),
  status: z.enum(["planned", "running", "passed", "failed", "blocked"]),
  note: z.string().trim().max(4_000).optional().nullable(),
  failureSummary: z.string().trim().max(2_000).optional().nullable(),
  evidenceUrl: z.string().trim().max(2_000).url().refine((value) => value.startsWith("https://"), "رابط الدليل يجب أن يستخدم HTTPS").optional().nullable()
}).superRefine((value, context) => {
  if (["failed", "blocked"].includes(value.status) && !value.failureSummary?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["failureSummary"], message: "سبب الفشل أو الحجب مطلوب لهذه الحالة" });
  }
});

async function access() {
  const session = await requireAuth();
  const [user] = await db.select({ isTestAccount: users.isTestAccount }).from(users).where(eq(users.id, session.userId)).limit(1);
  const admin = hasRole(session, "super_admin");
  if (!admin && !user?.isTestAccount) return { session, admin: false, allowed: false };
  return { session, admin, allowed: true };
}

export async function GET() {
  try {
    const actor = await access();
    if (!actor.allowed) return fail("هذه الصفحة مخصصة لحسابات QA أو مسؤول المنصة", 403);
    const runs = await db
      .select({
        id: qaTestRuns.id,
        caseKey: qaTestRuns.caseKey,
        environment: qaTestRuns.environment,
        category: qaTestRuns.category,
        status: qaTestRuns.status,
        severity: qaTestRuns.severity,
        executorUserId: qaTestRuns.executorUserId,
        evidenceUrl: qaTestRuns.evidenceUrl,
        note: qaTestRuns.note,
        failureSummary: qaTestRuns.failureSummary,
        startedAt: qaTestRuns.startedAt,
        completedAt: qaTestRuns.completedAt,
        createdAt: qaTestRuns.createdAt
      })
      .from(qaTestRuns)
      .where(actor.admin ? undefined : eq(qaTestRuns.executorUserId, actor.session.userId))
      .orderBy(desc(qaTestRuns.createdAt))
      .limit(actor.admin ? 300 : 100);
    return ok({ runs, scope: actor.admin ? "all" : "own" });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل سجلات الاختبار");
  }
}

export async function POST(request: Request) {
  try {
    const actor = await access();
    if (!actor.allowed) return fail("هذه الصفحة مخصصة لحسابات QA أو مسؤول المنصة", 403);
    const payload = submissionSchema.parse(await request.json());
    const testCase = findQaTestCase(payload.caseKey);
    if (!testCase) return fail("حالة الاختبار غير معروفة في كتالوج QA", 422);

    const now = new Date();
    const [run] = await db
      .insert(qaTestRuns)
      .values({
        caseKey: testCase.key,
        environment: "staging",
        category: testCase.category,
        status: payload.status,
        severity: testCase.severity,
        executorUserId: actor.session.userId,
        evidenceUrl: payload.evidenceUrl || null,
        note: payload.note || null,
        failureSummary: payload.failureSummary || null,
        startedAt: payload.status === "running" ? now : null,
        completedAt: ["passed", "failed", "blocked"].includes(payload.status) ? now : null
      })
      .returning();

    await writeAuditLog({
      actorId: actor.session.userId,
      action: "create",
      category: "system",
      entityType: "qa_test_run",
      entityId: run.id,
      afterData: { caseKey: run.caseKey, status: run.status, severity: run.severity, environment: run.environment, evidenceUrl: run.evidenceUrl || null }
    });
    return created({ run, message: "تم تسجيل نتيجة الاختبار ودليلها" });
  } catch (error) {
    return handleApiError(error, "تعذر تسجيل نتيجة الاختبار");
  }
}
