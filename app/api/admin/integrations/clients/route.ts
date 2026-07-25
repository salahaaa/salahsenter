export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";
import { createIntegrationClient, listIntegrationDashboardData } from "@/lib/integrations/erp/admin-service";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  clientKey: z.string().min(3).max(120).regex(/^[a-zA-Z0-9_.:-]+$/),
  name: z.string().min(2).max(180),
  provider: z.string().max(80).optional(),
  systemType: z.string().max(80).optional(),
  storeIds: z.array(z.string().uuid()).default([]),
  scopes: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({})
});

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "system.integrations.manage");
    return ok(await listIntegrationDashboardData());
  } catch (error) {
    return handleApiError(error, "تعذر تحميل عملاء التكامل");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "system.integrations.manage");
    const payload = schema.parse(await request.json());
    const result = await createIntegrationClient(payload);
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "integration_client", entityId: result.client.id, afterData: { client: result.client, apiKeyReturnedOnce: true } });
    return created({ ...result, warning: "اعرض API Key مرة واحدة فقط للتاجر/الفني ولا تحفظه في ملفات المشروع." });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء عميل التكامل");
  }
}
