export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";
import { rotateIntegrationClientKey } from "@/lib/integrations/erp/admin-service";
import { writeAuditLog } from "@/lib/audit";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "system.integrations.manage");
    const { id } = await context.params;
    const result = await rotateIntegrationClientKey(id);
    if (!result.client) return fail("عميل التكامل غير موجود", 404);
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "integration_client_key_rotation", entityId: id, afterData: { rotated: true } });
    return ok({ ...result, warning: "هذا المفتاح يظهر مرة واحدة فقط." });
  } catch (error) {
    return handleApiError(error, "تعذر تدوير مفتاح التكامل");
  }
}
