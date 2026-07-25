export const dynamic = "force-dynamic";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { activateBranchFinancialTerms, listAdminBranches, reviewBranch } from "@/lib/enterprise/store-branches";

const reviewSchema = z.object({
  action: z.literal("review").default("review"),
  branchId: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  revenueModel: z.enum(["monthly_rent", "sales_commission", "hybrid"]).default("monthly_rent"),
  rentAmount: z.coerce.number().min(0).optional(),
  commissionRate: z.coerce.number().min(0).max(100).optional(),
  rentCurrency: z.string().max(10).optional(),
  dueDays: z.coerce.number().int().min(1).max(90).optional(),
  graceDays: z.coerce.number().int().min(0).max(90).optional(),
  adminNote: z.string().optional()
});
const activateSchema = z.object({ action: z.literal("activate_addendum"), addendumId: z.string().uuid(), adminNote: z.string().optional() });

export async function GET() {
  try { const session = await requireAuth(); await assertAdmin(session, "branches.manage"); return ok({ branches: await listAdminBranches() }); }
  catch (error) { return handleApiError(error, "تعذر تحميل طلبات الفروع"); }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth(); await assertAdmin(session, "branches.manage");
    const raw = await request.json();
    const activation = activateSchema.safeParse(raw);
    if (activation.success) {
      const result = await activateBranchFinancialTerms(session.userId, activation.data.addendumId, activation.data.adminNote);
      return ok({ ...result, message: "تم اعتماد ملحق الفرع وتفعيل دورته المالية الموحدة" });
    }
    const payload = reviewSchema.parse(raw);
    const result = await reviewBranch(session.userId, payload);
    return ok({ ...result, message: payload.status === "approved" ? "تم إنشاء ملحق الفرع بانتظار توقيع التاجر" : "تم رفض طلب الفرع" });
  } catch (error) { return handleApiError(error, "تعذر مراجعة طلب الفرع"); }
}
