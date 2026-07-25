export const dynamic = "force-dynamic";

import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getAdminPlatformRevenue, upsertMerchantPromotionAgreement } from "@/lib/platform-revenue/service";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  storeId: z.string().uuid(), merchantId: z.string().uuid(), contractId: z.string().uuid().optional().nullable(), currency: z.string().trim().min(3).max(10).default("YER"),
  homepageBannerFee: z.coerce.number().min(0), featuredProductFee: z.coerce.number().min(0), featuredStoreFee: z.coerce.number().min(0),
  status: z.enum(["draft", "active", "paused", "terminated"]).default("active"), startsAt: z.string().datetime().optional(), endsAt: z.string().datetime().optional().nullable(), note: z.string().trim().max(1_500).optional().nullable()
});

export async function GET() {
  try { const session = await requireAuth(); await assertAdminOperation(session, "platform_revenue.statements.view"); const data = await getAdminPlatformRevenue(); return ok({ promotionAgreements: data.promotionAgreements }); }
  catch (error) { return handleApiError(error, "تعذر تحميل اتفاقات الترويج"); }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(); await assertAdminOperation(session, "platform_revenue.promotions.manage");
    const payload = schema.parse(await request.json());
    const result = await upsertMerchantPromotionAgreement({ ...payload, startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined, endsAt: payload.endsAt ? new Date(payload.endsAt) : null, actorId: session.userId });
    await writeAuditLog({ actorId: session.userId, action: "update", category: "financial", entityType: "merchant_promotion_agreement", entityId: result.agreement.id, beforeData: result.before, afterData: result.agreement });
    return created({ agreement: result.agreement, message: "تم حفظ اتفاق الترويج المستقل عن عقد الإيجار" });
  } catch (error) { return handleApiError(error, "تعذر حفظ اتفاق الترويج"); }
}
