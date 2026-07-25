export const dynamic = "force-dynamic";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getAdminErpIntegrationRequests, reviewErpIntegrationRequest } from "@/lib/integrations/erp/onboarding";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ requestId: z.string().uuid(), action: z.enum(["start_review", "request_information", "assign_connector", "mark_ready_for_certification", "reject", "activate"]), connectorCatalogId: z.string().uuid().optional().nullable(), certificationId: z.string().uuid().optional().nullable(), assignedTo: z.string().uuid().optional().nullable(), note: z.string().trim().max(2_000).optional().nullable() });
export async function GET() {
  try { const session = await requireAuth(); await assertAdminOperation(session, "erp.requests.review"); return ok(await getAdminErpIntegrationRequests()); }
  catch (error) { return handleApiError(error, "تعذر تحميل طلبات ERP"); }
}
export async function PATCH(request: Request) {
  try {
    const session = await requireAuth(); const payload = schema.parse(await request.json());
    await assertAdminOperation(session, payload.action === "activate" ? "erp.requests.activate" : "erp.requests.review");
    const result = await reviewErpIntegrationRequest({ ...payload, actorId: session.userId });
    await writeAuditLog({ actorId: session.userId, action: payload.action === "reject" ? "reject" : "update", category: "administrative", entityType: "erp.integration_request", entityId: payload.requestId, beforeData: result.before, afterData: { request: result.request, connector: result.connector, client: result.client, apiKeyReturnedOnce: Boolean(result.apiKey) } });
    return ok({ ...result, warning: result.apiKey ? "اعرض Integration Key مرة واحدة فقط للتاجر/الفني؛ لا تحفظه في request أو source code." : undefined, message: "تم تحديث دورة طلب ERP" });
  } catch (error) { return handleApiError(error, "تعذر تحديث طلب ERP"); }
}
