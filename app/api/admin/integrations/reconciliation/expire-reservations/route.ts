export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";
import { expireReservations } from "@/lib/integrations/accounting/reliability";
import { writeAuditLog } from "@/lib/audit";

export async function POST() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "system.erp.manage");
    const result = await expireReservations({ limit: 100, reason: "manual_admin" });
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "reservation_expiry", afterData: result });
    return ok({ result, message: "تم إنهاء الحجوزات المنتهية" });
  } catch (error) {
    return handleApiError(error, "تعذر إنهاء الحجوزات المنتهية");
  }
}
