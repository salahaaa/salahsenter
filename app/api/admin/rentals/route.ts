export const dynamic = "force-dynamic";

import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { createOrUpdateRentalAgreement, getAdminRentalCollections } from "@/lib/rentals/service";
import { assertAdmin } from "@/lib/rbac";

const agreementSchema = z.object({
  storeId: z.string().uuid(),
  merchantId: z.string().uuid(),
  contractId: z.string().uuid().optional().nullable(),
  subscriptionId: z.string().uuid().optional().nullable(),
  baseRent: z.coerce.number().min(0),
  currency: z.string().max(10).default("YER"),
  billingCycle: z.enum(["monthly", "quarterly", "semi_annual", "annual"]).default("monthly"),
  graceDays: z.coerce.number().int().min(0).max(90).default(7),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional().nullable(),
  status: z.enum(["draft", "active", "grace", "overdue", "frozen", "terminated"]).default("active")
});

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "contracts.manage");
    return ok(await getAdminRentalCollections());
  } catch (error) {
    return handleApiError(error, "تعذر تحميل تحصيلات الإيجار");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "contracts.manage");
    const payload = agreementSchema.parse(await request.json());
    const agreement = await createOrUpdateRentalAgreement({ ...payload, startsAt: payload.startsAt ? new Date(payload.startsAt) : undefined, endsAt: payload.endsAt ? new Date(payload.endsAt) : null, createdBy: session.userId });
    await writeAuditLog({ actorId: session.userId, action: "create", category: "financial", entityType: "rental.agreement_upserted", entityId: agreement.id, afterData: agreement });
    return created({ agreement, message: "تم حفظ اتفاق الإيجار" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ اتفاق الإيجار");
  }
}
