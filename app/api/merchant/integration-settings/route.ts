export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { handleApiError, fail, ok } from "@/lib/api";
import { requireAuth, hasStoreAccess } from "@/lib/auth";
import { db, systemSettings } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { Permission, userHasStorePermission } from "@/lib/rbac";
import { normalizeIntegrationSettings, defaultMerchantIntegrationSettings } from "@/lib/commerce/financial-strategy";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  storeId: z.string().uuid().optional(),
  integrationEnabled: z.boolean().default(false),
  integrationMode: z.enum(["ERP", "STANDALONE"]).default("STANDALONE"),
  erpProvider: z.string().max(120).optional().default("generic")
});

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ settings: defaultMerchantIntegrationSettings });
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية هذا المتجر", 403);
    const [setting] = await db.select().from(systemSettings).where(and(eq(systemSettings.group, `store:${store.id}`), eq(systemSettings.key, "integration_settings"))).limit(1);
    return ok({ settings: normalizeIntegrationSettings(setting?.value || defaultMerchantIntegrationSettings) });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل إعدادات التكامل");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const primary = await getMerchantPrimaryStore(session.userId);
    const storeId = payload.storeId || primary?.id;
    if (!storeId) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasStorePermission(session.userId, storeId, Permission.ManageStoreSettings))) return fail("لا تملك صلاحية إعدادات المتجر", 403);
    if (payload.integrationMode === "ERP" || payload.integrationEnabled) return fail("وضع ERP لا يفتحه التاجر مباشرة. اطلب من الإدارة اعتماد الموصل والشهادة ثم فتح الميزة للمتجر.", 403);
    const value = normalizeIntegrationSettings({ integrationEnabled: false, integrationMode: "STANDALONE", erpProvider: "none", erpAccess: "disabled", updatedAt: new Date().toISOString() });
    const [setting] = await db.insert(systemSettings).values({ group: `store:${storeId}`, key: "integration_settings", value, isPublic: false, updatedBy: session.userId }).onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value, updatedBy: session.userId, updatedAt: new Date() } }).returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "store_integration_settings", entityId: storeId, afterData: setting });
    return ok({ settings: value, message: "تم تثبيت وضع Standalone؛ يمكن للإدارة وحدها فتح ERP بعد الشهادة." });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ إعدادات التكامل");
  }
}
