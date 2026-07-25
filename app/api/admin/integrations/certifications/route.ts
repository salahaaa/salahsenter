export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db, erpConnectorCertifications, integrationClients, stores } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { transitionErpCertification, upsertErpCertification } from "@/lib/integrations/erp/certification";

const createSchema = z.object({ clientId: z.string().uuid(), storeId: z.string().uuid().optional().nullable(), note: z.string().max(2_000).optional().nullable() });
const patchSchema = z.object({ id: z.string().uuid(), action: z.enum(["certify", "reject", "recheck"]), note: z.string().max(2_000).optional().nullable() });

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "system.erp.manage");
    const [certifications, clients, storeRows] = await Promise.all([
      db.select({ certification: erpConnectorCertifications, clientName: integrationClients.name, clientKey: integrationClients.clientKey, storeName: stores.name }).from(erpConnectorCertifications).innerJoin(integrationClients, eq(erpConnectorCertifications.integrationClientId, integrationClients.id)).leftJoin(stores, eq(erpConnectorCertifications.storeId, stores.id)).orderBy(desc(erpConnectorCertifications.updatedAt)).limit(200),
      db.select({ id: integrationClients.id, name: integrationClients.name, clientKey: integrationClients.clientKey }).from(integrationClients).orderBy(desc(integrationClients.createdAt)).limit(200),
      db.select({ id: stores.id, name: stores.name }).from(stores).limit(500)
    ]);
    return ok({ certifications, clients, stores: storeRows });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل شهادات ERP");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "system.erp.manage");
    const payload = createSchema.parse(await request.json());
    const result = await upsertErpCertification({ clientId: payload.clientId, storeId: payload.storeId, actorId: session.userId, note: payload.note });
    await writeAuditLog({ actorId: session.userId, action: "create", category: "administrative", entityType: "erp.connector_certification", entityId: result.certification.id, afterData: result });
    return created({ ...result, message: "تم فحص جاهزية موصل ERP" });
  } catch (error) {
    return handleApiError(error, "تعذر فحص موصل ERP");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "system.erp.manage");
    const payload = patchSchema.parse(await request.json());
    const result = await transitionErpCertification({ ...payload, actorId: session.userId });
    await writeAuditLog({ actorId: session.userId, action: "update", category: "administrative", entityType: "erp.connector_certification", entityId: payload.id, afterData: result });
    return ok({ ...result, message: "تم تحديث حالة شهادة ERP" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث شهادة ERP");
  }
}
