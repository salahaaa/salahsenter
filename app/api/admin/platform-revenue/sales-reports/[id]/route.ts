export const dynamic = "force-dynamic";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { issueMerchantPlatformStatement, reviewMerchantSalesReport } from "@/lib/platform-revenue/service";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ action: z.enum(["approve", "reject"]), note: z.string().trim().min(3).max(1_500).optional() });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const session = await requireAuth(); await assertAdminOperation(session, "platform_revenue.sales_reports.review"); const payload = schema.parse(await request.json());
    const result = await reviewMerchantSalesReport({ reportId: id, actorId: session.userId, action: payload.action, note: payload.note });
    let statementResult = null;
    if (payload.action === "approve") statementResult = await issueMerchantPlatformStatement({ storeId: result.report.storeId, periodStart: result.report.periodStart, periodEnd: result.report.periodEnd, actorId: session.userId });
    await writeAuditLog({ actorId: session.userId, action: payload.action, category: "financial", entityType: "merchant_sales_report", entityId: id, beforeData: result.before, afterData: { report: result.report, statement: statementResult?.statement || null } });
    return ok({ report: result.report, statement: statementResult?.statement || null, message: payload.action === "approve" ? "تم اعتماد التقرير ومحاولة إصدار الكشف الموحد" : "تم رفض تقرير المبيعات" });
  } catch (error) { return handleApiError(error, "تعذر مراجعة تقرير المبيعات"); }
}
