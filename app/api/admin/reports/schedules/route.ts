export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, scheduledReportDeliveries, scheduledReports } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { nextScheduledRun } from "@/lib/reports/scheduled";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ name: z.string().trim().min(2).max(180), reportType: z.enum(["financial_summary", "reconciliation"]), frequency: z.enum(["daily", "weekly", "monthly"]), timezone: z.string().max(80).default("Asia/Aden"), recipients: z.array(z.string().email()).min(1).max(30), outputFormat: z.enum(["csv", "json", "pdf"]).default("csv") });

export async function GET() {
  try {
    const session = await requireAuth(); await assertAdminOperation(session, "finance.reports.view");
    const [reports, deliveries] = await Promise.all([db.select().from(scheduledReports).orderBy(desc(scheduledReports.createdAt)).limit(100), db.select().from(scheduledReportDeliveries).orderBy(desc(scheduledReportDeliveries.createdAt)).limit(200)]);
    return ok({ reports, deliveries });
  } catch (error) { return handleApiError(error, "تعذر تحميل التقارير المجدولة"); }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(); await assertAdminOperation(session, "finance.reports.export");
    const payload = schema.parse(await request.json());
    const [report] = await db.insert(scheduledReports).values({ ...payload, nextRunAt: nextScheduledRun(new Date(), payload.frequency), createdBy: session.userId }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", category: "financial", entityType: "scheduled_report", entityId: report.id, afterData: report });
    return created({ report, message: "تمت جدولة التقرير" });
  } catch (error) { return handleApiError(error, "تعذر جدولة التقرير"); }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth(); await assertAdminOperation(session, "finance.reports.export");
    const payload = z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(await request.json());
    const [before] = await db.select().from(scheduledReports).where(eq(scheduledReports.id, payload.id)).limit(1);
    if (!before) return fail("التقرير المجدول غير موجود", 404);
    const [report] = await db.update(scheduledReports).set({ isActive: payload.isActive, updatedAt: new Date() }).where(eq(scheduledReports.id, payload.id)).returning();
    await writeAuditLog({ actorId: session.userId, action: "update", category: "financial", entityType: "scheduled_report", entityId: report.id, beforeData: before, afterData: report });
    return ok({ report, message: "تم تحديث حالة التقرير المجدول" });
  } catch (error) { return handleApiError(error, "تعذر تحديث التقرير المجدول"); }
}
