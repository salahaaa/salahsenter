export const dynamic = "force-dynamic";

import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getAdminPlatformRevenue, upsertMerchantRevenueTerms } from "@/lib/platform-revenue/service";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  storeId: z.string().uuid(), merchantId: z.string().uuid(), contractId: z.string().uuid().optional().nullable(),
  model: z.enum(["monthly_rent", "sales_commission", "hybrid"]), monthlyRent: z.coerce.number().min(0), commissionRate: z.coerce.number().min(0).max(100),
  currency: z.string().trim().min(3).max(10).default("YER"), dueDays: z.coerce.number().int().min(1).max(90).default(7), graceDays: z.coerce.number().int().min(0).max(90).default(7),
  status: z.enum(["draft", "active", "paused", "suspended", "terminated"]).default("active"), startsAt: z.string().datetime().optional(), endsAt: z.string().datetime().optional().nullable(), note: z.string().trim().max(1_500).optional().nullable()
});

export async function GET() {
  try { const session = await requireAuth(); await assertAdminOperation(session, "platform_revenue.statements.view"); return ok(await getAdminPlatformRevenue()); }
  catch (error) { return handleApiError(error, "تعذر تحميل إعدادات إيراد المنصة"); }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(); await assertAdminOperation(session, "platform_revenue.terms.manage");
    const payload = schema.parse(await request.json());
    const result = await upsertMerchantRevenueTerms({ ...payload, startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined, endsAt: payload.endsAt ? new Date(payload.endsAt) : null, actorId: session.userId });
    await writeAuditLog({ actorId: session.userId, action: "update", category: "financial", entityType: "platform_revenue_terms", entityId: result.terms.id, beforeData: result.before, afterData: result.terms });
    return created({ terms: result.terms, message: "تم حفظ نموذج إيراد المنصة للمتجر وتفعيل الفوترة الموحدة" });
  } catch (error) { return handleApiError(error, "تعذر حفظ شروط إيراد المنصة"); }
}
