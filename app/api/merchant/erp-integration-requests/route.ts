export const dynamic = "force-dynamic";

import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { createErpIntegrationRequest, getMerchantErpIntegrationRequests } from "@/lib/integrations/erp/onboarding";
import { userHasStoreOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  provider: z.string().trim().min(2).max(160), erpVersion: z.string().trim().max(100).optional().nullable(),
  erpType: z.enum(["desktop", "cloud", "sql_server", "access", "pos", "custom"]).default("desktop"),
  connectionMethod: z.enum(["local_agent", "cloud_api", "file_exchange", "manual_export", "custom"]).default("local_agent"),
  branchCount: z.coerce.number().int().min(0).max(10_000).default(0), warehouseCount: z.coerce.number().int().min(0).max(10_000).default(0),
  businessActivity: z.string().trim().max(180).optional().nullable(), operationsVolume: z.enum(["low", "medium", "high", "enterprise"]).default("medium"),
  technicalContact: z.object({ name: z.string().trim().max(160).optional(), phone: z.string().trim().max(60).optional(), email: z.string().trim().email().optional(), role: z.string().trim().max(120).optional() }).default({}),
  readiness: z.object({ hasTechnicalSupport: z.boolean().default(false), hasDatabaseBackup: z.boolean().default(false), canInstallAgent: z.boolean().default(false), canCreateStagingTables: z.boolean().default(false), notes: z.string().trim().max(1_500).optional() }).default({ hasTechnicalSupport: false, hasDatabaseBackup: false, canInstallAgent: false, canCreateStagingTables: false }),
  merchantNote: z.string().trim().max(2_000).optional().nullable()
});

export async function GET() {
  try { const session = await requireAuth(); return ok(await getMerchantErpIntegrationRequests(session.userId)); }
  catch (error) { return handleApiError(error, "تعذر تحميل طلبات ربط ERP"); }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(); const store = await getMerchantPrimaryStore(session.userId);
    if (!store || !hasStoreAccess(session, store.id)) return fail("لا يوجد متجر متاح لطلب الربط", 403);
    if (!(await userHasStoreOperation(session.userId, store.id, "erp.requests.create"))) return fail("لا تملك صلاحية طلب ربط ERP", 403);
    const payload = schema.parse(await request.json());
    const integrationRequest = await createErpIntegrationRequest({ storeId: store.id, merchantId: session.userId, ...payload });
    await writeAuditLog({ actorId: session.userId, action: "create", category: "administrative", entityType: "erp.integration_request", entityId: integrationRequest.id, afterData: integrationRequest });
    return created({ request: integrationRequest, message: "تم إرسال طلب ربط ERP للإدارة للمراجعة" });
  } catch (error) { return handleApiError(error, "تعذر إرسال طلب ربط ERP"); }
}
