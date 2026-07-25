export const dynamic = "force-dynamic";

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, suppliers } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { userHasStoreOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  storeId: z.string().uuid().optional(),
  code: z.string().trim().max(80).optional().nullable(),
  name: z.string().trim().min(2).max(180),
  contactName: z.string().trim().max(160).optional().nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  address: z.string().trim().max(2_000).optional().nullable(),
  notes: z.string().trim().max(4_000).optional().nullable()
});

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const requested = new URL(request.url).searchParams.get("storeId");
    const store = requested ? { id: requested } : await getMerchantPrimaryStore(session.userId);
    if (!store || !hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية هذا المتجر", 403);
    if (!(await userHasStoreOperation(session.userId, store.id, "inventory.view"))) return fail("لا تملك صلاحية عرض الموردين", 403);
    const items = await db.select().from(suppliers).where(eq(suppliers.storeId, store.id)).orderBy(asc(suppliers.name));
    return ok({ suppliers: items });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل الموردين");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const storeId = payload.storeId || (await getMerchantPrimaryStore(session.userId))?.id;
    if (!storeId || !hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية هذا المتجر", 403);
    if (!(await userHasStoreOperation(session.userId, storeId, "inventory.manage"))) return fail("لا تملك صلاحية إدارة الموردين", 403);
    const [supplier] = await db.insert(suppliers).values({ ...payload, storeId, code: payload.code || null, email: payload.email || null, createdBy: session.userId }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", category: "inventory", entityType: "inventory.supplier", entityId: supplier.id, afterData: supplier });
    return created({ supplier, message: "تم إنشاء المورد" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء المورد");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.extend({ id: z.string().uuid(), status: z.enum(["active", "inactive"]).optional() }).parse(await request.json());
    const [before] = await db.select().from(suppliers).where(eq(suppliers.id, payload.id)).limit(1);
    if (!before) return fail("المورد غير موجود", 404);
    if (!hasStoreAccess(session, before.storeId) || !(await userHasStoreOperation(session.userId, before.storeId, "inventory.manage"))) return fail("لا تملك صلاحية إدارة الموردين", 403);
    const [supplier] = await db.update(suppliers).set({ ...payload, code: payload.code || null, email: payload.email || null, updatedAt: new Date() }).where(and(eq(suppliers.id, before.id), eq(suppliers.storeId, before.storeId))).returning();
    await writeAuditLog({ actorId: session.userId, action: "update", category: "inventory", entityType: "inventory.supplier", entityId: supplier.id, beforeData: before, afterData: supplier });
    return ok({ supplier, message: "تم تحديث المورد" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث المورد");
  }
}
