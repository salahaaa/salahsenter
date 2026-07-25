export const dynamic = "force-dynamic";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { optionalUrlOrPathSchema, requiredUrlOrPathSchema } from "@/lib/validators";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { categories, colors, db, sizes, units } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { slugify } from "@/lib/slug";
import { writeAuditLog } from "@/lib/audit";
import { isStoreOperational } from "@/lib/store-guards";
import { Permission, userHasStorePermission } from "@/lib/rbac";

const settingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("category"), storeId: z.string().uuid().optional(), name: z.string().min(2), slug: z.string().optional(), imageUrl: optionalUrlOrPathSchema, sortOrder: z.coerce.number().int().default(0), isActive: z.boolean().default(true) }),
  z.object({ kind: z.literal("unit"), storeId: z.string().uuid().optional(), name: z.string().min(1), symbol: z.string().optional(), sortOrder: z.coerce.number().int().default(0), isActive: z.boolean().default(true) }),
  z.object({ kind: z.literal("size"), storeId: z.string().uuid().optional(), name: z.string().min(1), sortOrder: z.coerce.number().int().default(0), isActive: z.boolean().default(true) }),
  z.object({ kind: z.literal("color"), storeId: z.string().uuid().optional(), name: z.string().min(1), hexCode: z.string().optional(), sortOrder: z.coerce.number().int().default(0), isActive: z.boolean().default(true) })
]);

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ categories: [], units: [], sizes: [], colors: [] });

    const [categoryItems, unitItems, sizeItems, colorItems] = await Promise.all([
      db.select().from(categories).where(eq(categories.storeId, store.id)).orderBy(asc(categories.sortOrder), asc(categories.name)),
      db.select().from(units).where(eq(units.storeId, store.id)).orderBy(asc(units.sortOrder), asc(units.name)),
      db.select().from(sizes).where(eq(sizes.storeId, store.id)).orderBy(asc(sizes.sortOrder), asc(sizes.name)),
      db.select().from(colors).where(eq(colors.storeId, store.id)).orderBy(asc(colors.sortOrder), asc(colors.name))
    ]);

    return ok({ categories: categoryItems, units: unitItems, sizes: sizeItems, colors: colorItems });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل إعدادات المتجر");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = settingSchema.parse(await request.json());
    const primaryStore = await getMerchantPrimaryStore(session.userId);
    const storeId = payload.storeId || primaryStore?.id;
    if (!storeId) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasStorePermission(session.userId, storeId, Permission.ManageStoreSettings))) return fail("لا تملك صلاحية إعدادات المتجر", 403);
    if (!(await isStoreOperational(storeId))) return fail("المتجر مجمد أو غير مفعل؛ لا يمكن تنفيذ عمليات تشغيلية حتى إعادة فتحه من الأدمن", 403);

    if (payload.kind === "category") {
      const [item] = await db.insert(categories).values({ storeId, name: payload.name, slug: payload.slug || slugify(payload.name), imageUrl: payload.imageUrl || null, sortOrder: payload.sortOrder, isActive: payload.isActive }).returning();
      await writeAuditLog({ actorId: session.userId, action: "create", entityType: "category", entityId: item.id, afterData: item });
      return created({ item, message: "تم حفظ القسم بنجاح" });
    }
    if (payload.kind === "unit") {
      const [item] = await db
        .insert(units)
        .values({ storeId, name: payload.name, symbol: payload.symbol, sortOrder: payload.sortOrder, isActive: payload.isActive })
        .onConflictDoUpdate({
          target: [units.storeId, units.name],
          set: { symbol: payload.symbol, sortOrder: payload.sortOrder, isActive: payload.isActive }
        })
        .returning();
      await writeAuditLog({ actorId: session.userId, action: "create", entityType: "unit", entityId: item.id, afterData: item });
      return created({ item, message: "تم حفظ الوحدة بنجاح" });
    }
    if (payload.kind === "size") {
      const [item] = await db
        .insert(sizes)
        .values({ storeId, name: payload.name, sortOrder: payload.sortOrder, isActive: payload.isActive })
        .onConflictDoUpdate({ target: [sizes.storeId, sizes.name], set: { sortOrder: payload.sortOrder, isActive: payload.isActive } })
        .returning();
      await writeAuditLog({ actorId: session.userId, action: "create", entityType: "size", entityId: item.id, afterData: item });
      return created({ item, message: "تم حفظ المقاس بنجاح" });
    }
    if (payload.kind === "color") {
      const [item] = await db
        .insert(colors)
        .values({ storeId, name: payload.name, hexCode: payload.hexCode, sortOrder: payload.sortOrder, isActive: payload.isActive })
        .onConflictDoUpdate({ target: [colors.storeId, colors.name], set: { hexCode: payload.hexCode, sortOrder: payload.sortOrder, isActive: payload.isActive } })
        .returning();
      await writeAuditLog({ actorId: session.userId, action: "create", entityType: "color", entityId: item.id, afterData: item });
      return created({ item, message: "تم حفظ اللون بنجاح" });
    }

    return fail("نوع غير مدعوم", 400);
  } catch (error) {
    return handleApiError(error, "تعذر حفظ إعدادات المتجر");
  }
}
