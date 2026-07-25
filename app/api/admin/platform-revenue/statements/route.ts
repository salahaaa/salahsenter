export const dynamic = "force-dynamic";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getAdminPlatformRevenue, issueMerchantPlatformStatement, settlePlatformStatement } from "@/lib/platform-revenue/service";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const issueSchema = z.object({ storeId: z.string().uuid(), periodStart: z.string().datetime(), periodEnd: z.string().datetime() });
const settleSchema = z.object({ statementId: z.string().uuid(), action: z.enum(["approve_proof", "mark_paid", "reject_proof", "void"]), note: z.string().trim().min(3).max(1_500).optional() });

export async function GET() {
  try { const session = await requireAuth(); await assertAdminOperation(session, "platform_revenue.statements.view"); const data = await getAdminPlatformRevenue(); return ok({ statements: data.statements, outstanding: data.outstanding }); }
  catch (error) { return handleApiError(error, "تعذر تحميل كشوف إيراد المنصة"); }
}
export async function POST(request: Request) {
  try {
    const session = await requireAuth(); await assertAdminOperation(session, "platform_revenue.statements.issue"); const payload = issueSchema.parse(await request.json());
    if (new Date(payload.periodEnd) <= new Date(payload.periodStart)) return new Response(JSON.stringify({ success: false, message: "نهاية الفترة يجب أن تكون بعد البداية" }), { status: 422, headers: { "Content-Type": "application/json" } });
    const result = await issueMerchantPlatformStatement({ storeId: payload.storeId, periodStart: new Date(payload.periodStart), periodEnd: new Date(payload.periodEnd), actorId: session.userId });
    if (result.statement) await writeAuditLog({ actorId: session.userId, action: "create", category: "financial", entityType: "platform_revenue_statement", entityId: result.statement.id, afterData: { statement: result.statement, reason: result.reason } });
    return ok({ ...result, message: result.reason === "awaiting_sales_report" ? "أنشئ مسودة الكشف بانتظار اعتماد تقرير المبيعات" : "تمت معالجة كشف إيراد المنصة" });
  } catch (error) { return handleApiError(error, "تعذر إصدار كشف إيراد المنصة"); }
}
export async function PATCH(request: Request) {
  try {
    const session = await requireAuth(); await assertAdminOperation(session, "platform_revenue.statements.settle"); const payload = settleSchema.parse(await request.json());
    const result = await settlePlatformStatement({ ...payload, actorId: session.userId });
    await writeAuditLog({ actorId: session.userId, action: payload.action === "void" ? "status_change" : "approve", category: "financial", entityType: "platform_revenue_statement", entityId: payload.statementId, beforeData: result.before, afterData: result.statement });
    return ok({ statement: result.statement, message: "تم تحديث حالة كشف إيراد المنصة" });
  } catch (error) { return handleApiError(error, "تعذر تسوية كشف إيراد المنصة"); }
}
