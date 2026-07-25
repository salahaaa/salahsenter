export const dynamic = "force-dynamic";

import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { scanContractsForExpiry } from "@/lib/contract-actions";

export async function POST() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "contracts.manage");
    const alerts = await scanContractsForExpiry(session.userId);
    return ok({ alerts, message: "تم فحص العقود وتوليد التنبيهات" });
  } catch (error) {
    return handleApiError(error, "تعذر فحص العقود");
  }
}
