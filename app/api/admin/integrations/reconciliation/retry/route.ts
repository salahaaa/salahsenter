export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";
import { retryIntegrationEvent } from "@/lib/integrations/accounting/reliability";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ eventId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "system.erp.manage");
    const payload = schema.parse(await request.json());
    const result = await retryIntegrationEvent(payload.eventId);
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "integration_retry", entityId: payload.eventId, afterData: result });
    return ok({ result, message: "تمت إعادة الحدث إلى Retry Queue" });
  } catch (error) {
    return handleApiError(error, "تعذر إعادة الحدث إلى Retry Queue");
  }
}
