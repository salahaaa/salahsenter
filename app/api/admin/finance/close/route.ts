export const dynamic = "force-dynamic";

import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { assertAdminOperation } from "@/lib/rbac";
import { createFinancialCloseRun, transitionFinancialCloseRun, utcDayRange } from "@/lib/finance/close";
import { db, financialCloseRuns } from "@/lib/db";
import { desc } from "drizzle-orm";

const createSchema = z.object({ periodStart: z.string().datetime().optional(), periodEnd: z.string().datetime().optional(), note: z.string().max(2_000).optional().nullable() });
const transitionSchema = z.object({ id: z.string().uuid(), action: z.enum(["review", "close", "reopen"]), note: z.string().max(2_000).optional().nullable() });

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "finance.reports.view");
    return ok({ runs: await db.select().from(financialCloseRuns).orderBy(desc(financialCloseRuns.periodEnd)).limit(100) });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل دورات الإقفال المالي");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "finance.withdrawals.manage");
    const payload = createSchema.parse(await request.json());
    const fallback = utcDayRange();
    const run = await createFinancialCloseRun({ periodStart: payload.periodStart ? new Date(payload.periodStart) : fallback.start, periodEnd: payload.periodEnd ? new Date(payload.periodEnd) : fallback.end, actorId: session.userId, note: payload.note });
    await writeAuditLog({ actorId: session.userId, action: "create", category: "financial", entityType: "financial.close_run", entityId: run.id, afterData: run });
    return created({ run, message: "تم إنشاء لقطة الإقفال المالي للمراجعة" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء دورة الإقفال المالي");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "finance.withdrawals.manage");
    const payload = transitionSchema.parse(await request.json());
    const result = await transitionFinancialCloseRun({ ...payload, actorId: session.userId });
    await writeAuditLog({ actorId: session.userId, action: "update", category: "financial", entityType: "financial.close_run", entityId: payload.id, beforeData: result.before, afterData: result.run });
    return ok({ ...result, message: "تم تحديث حالة الإقفال المالي" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث دورة الإقفال المالي");
  }
}
