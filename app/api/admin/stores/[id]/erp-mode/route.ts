export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { db, erpConnectorCertifications, integrationClients, stores, systemSettings } from "@/lib/db";
import { agentCapabilitiesForMode, sourceOfTruthForMode } from "@/lib/integrations/erp/source-of-truth";
import { assertAdminOperation } from "@/lib/rbac";

const schema = z.object({ mode: z.enum(["ERP", "STANDALONE"]), certificationId: z.string().uuid().optional().nullable(), note: z.string().max(1_000).optional().nullable() });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdminOperation(session, "system.erp.manage");
    const [setting] = await db.select().from(systemSettings).where(and(eq(systemSettings.group, `store:${id}`), eq(systemSettings.key, "integration_settings"))).limit(1);
    return ok({ settings: setting?.value || null });
  } catch (error) { return handleApiError(error, "تعذر تحميل وضع ERP للمتجر"); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: storeId } = await context.params;
    const session = await requireAuth();
    await assertAdminOperation(session, "system.erp.manage");
    const payload = schema.parse(await request.json());
    const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
    if (!store) return fail("المتجر غير موجود", 404);
    let value: Record<string, unknown>;
    if (payload.mode === "ERP") {
      if (!payload.certificationId) return fail("اختر شهادة ERP معتمدة قبل فتح الوضع للمحل", 422);
      const [certification] = await db.select().from(erpConnectorCertifications).where(and(eq(erpConnectorCertifications.id, payload.certificationId), eq(erpConnectorCertifications.status, "certified"))).limit(1);
      if (!certification) return fail("شهادة ERP غير معتمدة", 409);
      if (certification.storeId && certification.storeId !== storeId) return fail("الشهادة لا تتبع هذا المتجر التجريبي", 403);
      const [client] = await db.select().from(integrationClients).where(eq(integrationClients.id, certification.integrationClientId)).limit(1);
      if (!client || client.status !== "active") return fail("عميل التكامل غير فعال", 409);
      if (client.storeIds.length && !client.storeIds.includes(storeId)) return fail("عميل التكامل غير مصرح لهذا المتجر", 403);
      value = {
        integrationEnabled: true,
        integrationMode: "ERP",
        erpAccess: "admin_enabled",
        erpProvider: client.provider,
        integrationClientKey: client.clientKey,
        certificationId: certification.id,
        sourceOfTruth: sourceOfTruthForMode("ERP"),
        agentCapabilities: agentCapabilitiesForMode("ERP"),
        featureAccess: { code: "erp_connector", state: "admin_grant", billing: "future_paid" },
        modeChangedBy: session.userId,
        modeChangedAt: new Date().toISOString(),
        note: payload.note || null
      };
    } else {
      value = {
        integrationEnabled: false,
        integrationMode: "STANDALONE",
        erpAccess: "disabled",
        erpProvider: "none",
        integrationClientKey: null,
        certificationId: null,
        sourceOfTruth: sourceOfTruthForMode("STANDALONE"),
        agentCapabilities: agentCapabilitiesForMode("STANDALONE"),
        featureAccess: { code: "erp_connector", state: "disabled", billing: "future_paid" },
        modeChangedBy: session.userId,
        modeChangedAt: new Date().toISOString(),
        note: payload.note || null
      };
    }
    const [setting] = await db.insert(systemSettings).values({ group: `store:${storeId}`, key: "integration_settings", value, isPublic: false, updatedBy: session.userId }).onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value, updatedBy: session.userId, updatedAt: new Date() } }).returning();
    await writeAuditLog({ actorId: session.userId, action: "update", category: "administrative", entityType: "erp.store_mode", entityId: storeId, afterData: { setting: setting.value, mode: payload.mode } });
    const origin = new URL(request.url).origin;
    return ok({ settings: setting.value, agentOnboarding: payload.mode === "ERP" ? { clientKey: value.integrationClientKey, storeId, endpoints: { register: `${origin}/api/integrations/agents/register`, heartbeat: `${origin}/api/integrations/agents/heartbeat`, config: `${origin}/api/integrations/config` }, note: "استخدم API key الذي أصدره الأدمن للـ Integration Client؛ لا يتم عرضه أو تخزينه هنا." } : null, message: payload.mode === "ERP" ? "تم فتح ERP Mode للمحل بعد الشهادة" : "تم تثبيت Standalone Mode للمحل" });
  } catch (error) { return handleApiError(error, "تعذر تحديث وضع ERP للمتجر"); }
}
