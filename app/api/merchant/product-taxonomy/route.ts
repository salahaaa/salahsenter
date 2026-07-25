export const dynamic = "force-dynamic";

import { and, asc, eq } from "drizzle-orm";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { categories, colors, db, productAttributes, productAttributeValues, sizes, units } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { generateCategoryCode } from "@/lib/product-coding";
import { slugify } from "@/lib/slug";
import { productTaxonomySchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import { isStoreOperational } from "@/lib/store-guards";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ categories: [], units: [], sizes: [], colors: [], attributes: [], values: [] });

    const [categoryItems, unitItems, sizeItems, colorItems, attributeItems, valueItems] = await Promise.all([
      db.select().from(categories).where(eq(categories.storeId, store.id)).orderBy(asc(categories.code), asc(categories.sortOrder), asc(categories.name)),
      db.select().from(units).where(eq(units.storeId, store.id)).orderBy(asc(units.sortOrder), asc(units.name)),
      db.select().from(sizes).where(eq(sizes.storeId, store.id)).orderBy(asc(sizes.sortOrder), asc(sizes.name)),
      db.select().from(colors).where(eq(colors.storeId, store.id)).orderBy(asc(colors.sortOrder), asc(colors.name)),
      db.select().from(productAttributes).where(eq(productAttributes.storeId, store.id)).orderBy(asc(productAttributes.sortOrder), asc(productAttributes.name)),
      db.select().from(productAttributeValues).orderBy(asc(productAttributeValues.sortOrder), asc(productAttributeValues.value))
    ]);

    const attributeIds = new Set(attributeItems.map((item) => item.id));
    return ok({ categories: categoryItems, units: unitItems, sizes: sizeItems, colors: colorItems, attributes: attributeItems, values: valueItems.filter((item) => attributeIds.has(item.attributeId)) });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل إعدادات الأصناف والمتغيرات");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = productTaxonomySchema.parse(await request.json());
    const primaryStore = await getMerchantPrimaryStore(session.userId);
    const storeId = "storeId" in payload ? payload.storeId || primaryStore?.id : primaryStore?.id;
    if (!storeId) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, storeId, [Permission.ManageProductTaxonomy, Permission.ManageStoreSettings]))) return fail("لا تملك صلاحية إعدادات الأصناف والمتغيرات", 403);
    if (!(await isStoreOperational(storeId))) return fail("المتجر مجمد أو غير مفعل؛ لا يمكن تنفيذ عمليات تشغيلية حتى إعادة فتحه من الأدمن", 403);

    if (payload.kind === "category") {
      const code = payload.codeMode === "manual" && payload.code ? payload.code : await generateCategoryCode(db, storeId, payload.parentId);
      const [existingCategory] = await db.select().from(categories).where(and(eq(categories.storeId, storeId), eq(categories.name, payload.name))).limit(1);
      if (existingCategory) return created({ item: existingCategory, message: "القسم موجود مسبقاً وتم اعتماده" });
      const [parent] = payload.parentId ? await db.select().from(categories).where(eq(categories.id, payload.parentId)).limit(1) : [];
      const [item] = await db
        .insert(categories)
        .values({
          storeId,
          parentId: payload.parentId || null,
          code,
          codeMode: payload.codeMode,
          level: parent ? parent.level + 1 : 0,
          name: payload.name,
          slug: slugify(`${code}-${payload.name}`),
          imageUrl: payload.imageUrl || null,
          sortOrder: payload.sortOrder,
          isActive: payload.isActive
        })
        .returning();
      await writeAuditLog({ actorId: session.userId, action: "create", entityType: "product_category", entityId: item.id, afterData: item });
      return created({ item, message: "تم حفظ المجموعة/القسم بنجاح" });
    }

    if (payload.kind === "attribute") {
      const [item] = await db
        .insert(productAttributes)
        .values({ storeId, ...payload })
        .onConflictDoUpdate({ target: [productAttributes.storeId, productAttributes.code], set: { name: payload.name, displayType: payload.displayType, isVariantOption: payload.isVariantOption, isRequired: payload.isRequired, sortOrder: payload.sortOrder, isActive: payload.isActive, updatedAt: new Date() } })
        .returning();
      await writeAuditLog({ actorId: session.userId, action: "create", entityType: "product_attribute", entityId: item.id, afterData: item });
      return created({ item, message: "تم حفظ الخاصية بنجاح" });
    }

    const [existingValue] = await db.select().from(productAttributeValues).where(and(eq(productAttributeValues.attributeId, payload.attributeId), eq(productAttributeValues.value, payload.value))).limit(1);
    if (existingValue) {
      const [item] = await db.update(productAttributeValues).set({ code: payload.code || existingValue.code, colorHex: payload.colorHex || existingValue.colorHex, imageUrl: payload.imageUrl || existingValue.imageUrl, sortOrder: payload.sortOrder, isActive: payload.isActive, updatedAt: new Date() }).where(eq(productAttributeValues.id, existingValue.id)).returning();
      await writeAuditLog({ actorId: session.userId, action: "update", entityType: "product_attribute_value", entityId: item.id, afterData: item });
      return created({ item, message: "تم حفظ قيمة الخاصية بنجاح" });
    }

    const [item] = await db
      .insert(productAttributeValues)
      .values({
        attributeId: payload.attributeId,
        value: payload.value,
        code: payload.code,
        colorHex: payload.colorHex,
        imageUrl: payload.imageUrl || null,
        sortOrder: payload.sortOrder,
        isActive: payload.isActive
      })
      .returning();
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "product_attribute_value", entityId: item.id, afterData: item });
    return created({ item, message: "تم حفظ قيمة الخاصية بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ إعدادات الأصناف والمتغيرات");
  }
}
