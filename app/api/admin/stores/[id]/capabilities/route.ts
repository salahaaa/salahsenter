export const dynamic = "force-dynamic";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, storeCapabilities, stores } from "@/lib/db";
import { PRODUCT_OS_CAPABILITIES } from "@/lib/products/advanced-inventory";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ capabilities: z.array(z.object({ code: z.enum(PRODUCT_OS_CAPABILITIES), isEnabled: z.boolean() })).min(1) });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const session = await requireAuth();
    await assertAdminOperation(session, "system.settings.view");
    const [store] = await db.select({ id: stores.id }).from(stores).where(eq(stores.id, id)).limit(1);
    if (!store) return fail("المتجر غير موجود", 404);
    const rows = await db.select().from(storeCapabilities).where(eq(storeCapabilities.storeId, id));
    return ok({ capabilities: PRODUCT_OS_CAPABILITIES.map((code) => ({ code, isEnabled: rows.find((row) => row.code === code)?.isEnabled || false })) });
  } catch (error) { return handleApiError(error, "تعذر تحميل قدرات المتجر"); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const session = await requireAuth();
    await assertAdminOperation(session, "system.settings.edit");
    const payload = schema.parse(await request.json());
    const [store] = await db.select({ id: stores.id }).from(stores).where(eq(stores.id, id)).limit(1);
    if (!store) return fail("المتجر غير موجود", 404);
    const before = await db.select().from(storeCapabilities).where(and(eq(storeCapabilities.storeId, id), inArray(storeCapabilities.code, payload.capabilities.map((item) => item.code))));
    const result = await db.transaction(async (tx) => Promise.all(payload.capabilities.map(async (capability) => {
      const [existing] = await tx.select().from(storeCapabilities).where(and(eq(storeCapabilities.storeId, id), eq(storeCapabilities.code, capability.code))).limit(1);
      if (existing) return (await tx.update(storeCapabilities).set({ isEnabled: capability.isEnabled, configuredBy: session.userId, updatedAt: new Date() }).where(eq(storeCapabilities.id, existing.id)).returning())[0];
      return (await tx.insert(storeCapabilities).values({ storeId: id, code: capability.code, isEnabled: capability.isEnabled, configuredBy: session.userId }).returning())[0];
    })));
    await writeAuditLog({ actorId: session.userId, action: "update", category: "inventory", entityType: "store_capabilities", entityId: id, beforeData: before, afterData: result });
    return ok({ capabilities: result, message: "تم تحديث قدرات القطاع للمتجر" });
  } catch (error) { return handleApiError(error, "تعذر تحديث قدرات المتجر"); }
}
