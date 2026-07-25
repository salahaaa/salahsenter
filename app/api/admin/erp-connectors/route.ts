export const dynamic = "force-dynamic";

import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { ensureGenericErpConnectors, getAdminErpIntegrationRequests, upsertErpConnectorCatalog } from "@/lib/integrations/erp/onboarding";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const optionalUrl = z.union([z.string().url(), z.literal(""), z.null()]).optional().transform((value) => value || null);
const schema = z.object({ id: z.string().uuid().optional().nullable(), code: z.string().trim().min(3).max(120).regex(/^[a-zA-Z0-9_.:-]+$/), provider: z.string().trim().min(2).max(160), displayName: z.string().trim().min(2).max(180), version: z.string().trim().min(1).max(80), systemType: z.string().trim().min(2).max(80), connectionModes: z.array(z.string().trim().min(2).max(80)).min(1).max(20), capabilities: z.record(z.boolean()).default({}), supportOwner: z.string().trim().max(180).optional().nullable(), documentationUrl: optionalUrl, agentPackageUrl: optionalUrl, packageChecksum: z.string().trim().max(180).optional().nullable(), status: z.enum(["draft", "active", "deprecated", "disabled"]).default("draft"), metadata: z.record(z.unknown()).default({}) });

export async function GET() {
  try { const session = await requireAuth(); await assertAdminOperation(session, "erp.connectors.manage"); await ensureGenericErpConnectors(); const data = await getAdminErpIntegrationRequests(); return ok({ connectors: data.connectors }); }
  catch (error) { return handleApiError(error, "تعذر تحميل موصلات ERP"); }
}
export async function POST(request: Request) {
  try { const session = await requireAuth(); await assertAdminOperation(session, "erp.connectors.manage"); const payload = schema.parse(await request.json()); const result = await upsertErpConnectorCatalog({ ...payload, id: payload.id || null, actorId: session.userId }); await writeAuditLog({ actorId: session.userId, action: result.before ? "update" : "create", entityType: "erp.connector_catalog", entityId: result.connector.id, beforeData: result.before, afterData: result.connector }); return created({ connector: result.connector, message: "تم حفظ موصل ERP في الكتالوج" }); }
  catch (error) { return handleApiError(error, "تعذر حفظ موصل ERP"); }
}
