export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { optionalUrlOrPathSchema, requiredUrlOrPathSchema } from "@/lib/validators";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { categories, db, productAttributes, productAttributeValues } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { writeAuditLog } from "@/lib/audit";
import { isStoreOperational } from "@/lib/store-guards";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";

const patchSchema = z.object({
  kind: z.enum(["category", "attribute", "value"]).optional(),
  name: z.string().min(1).optional(),
  parentId: z.string().uuid().nullable().optional(),
  code: z.string().optional().nullable(),
  codeMode: z.enum(["auto", "manual"]).optional(),
  imageUrl: optionalUrlOrPathSchema,
  displayType: z.enum(["button", "color", "dropdown", "radio", "text"]).optional(),
  isVariantOption: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  value: z.string().min(1).optional(),
  colorHex: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.boolean().optional()
});

type Kind = "category" | "attribute" | "value";

function readKind(request: Request, fallback?: string | null): Kind | null {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") || fallback;
  return kind === "category" || kind === "attribute" || kind === "value" ? kind : null;
}

async function resolveStoreId(kind: Kind, id: string) {
  if (kind === "category") {
    const [row] = await db.select({ storeId: categories.storeId }).from(categories).where(eq(categories.id, id)).limit(1);
    return row?.storeId || null;
  }
  if (kind === "attribute") {
    const [row] = await db.select({ storeId: productAttributes.storeId }).from(productAttributes).where(eq(productAttributes.id, id)).limit(1);
    return row?.storeId || null;
  }
  const [row] = await db
    .select({ storeId: productAttributes.storeId })
    .from(productAttributeValues)
    .innerJoin(productAttributes, eq(productAttributeValues.attributeId, productAttributes.id))
    .where(eq(productAttributeValues.id, id))
    .limit(1);
  return row?.storeId || null;
}

async function assertCanManage(session: Awaited<ReturnType<typeof requireAuth>>, storeId: string) {
  if (!hasStoreAccess(session, storeId)) return "لا تملك صلاحية إدارة هذا المتجر";
  if (!(await userHasAnyStorePermission(session.userId, storeId, [Permission.ManageProductTaxonomy, Permission.ManageStoreSettings]))) return "لا تملك صلاحية إعدادات الأصناف والمتغيرات";
  if (!(await isStoreOperational(storeId))) return "المتجر مجمد أو غير مفعل؛ لا يمكن تعديل إعدادات الأصناف والمتغيرات";
  return null;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = patchSchema.parse(await request.json());
    const kind = readKind(request, payload.kind);
    if (!kind) return fail("نوع العنصر مطلوب: category أو attribute أو value", 422);
    const storeId = await resolveStoreId(kind, id);
    if (!storeId) return fail("العنصر غير موجود", 404);
    const deny = await assertCanManage(session, storeId);
    if (deny) return fail(deny, 403);

    if (kind === "category") {
      const [before] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
      const [parent] = payload.parentId ? await db.select().from(categories).where(eq(categories.id, payload.parentId)).limit(1) : [];
      const [item] = await db
        .update(categories)
        .set({
          parentId: payload.parentId === undefined ? before.parentId : payload.parentId,
          code: payload.code === undefined ? before.code : payload.code || null,
          codeMode: payload.codeMode || before.codeMode,
          level: payload.parentId === undefined ? before.level : parent ? parent.level + 1 : 0,
          name: payload.name || before.name,
          slug: payload.name || payload.code ? slugify(`${payload.code || before.code || ""}-${payload.name || before.name}`) : before.slug,
          imageUrl: payload.imageUrl === undefined ? before.imageUrl : payload.imageUrl || null,
          sortOrder: payload.sortOrder ?? before.sortOrder,
          isActive: payload.isActive ?? before.isActive,
          updatedAt: new Date()
        })
        .where(eq(categories.id, id))
        .returning();
      await writeAuditLog({ actorId: session.userId, action: "update", entityType: "product_category", entityId: id, beforeData: before, afterData: item });
      return ok({ item, message: "تم تعديل المجموعة/القسم بنجاح" });
    }

    if (kind === "attribute") {
      const [before] = await db.select().from(productAttributes).where(eq(productAttributes.id, id)).limit(1);
      const [item] = await db
        .update(productAttributes)
        .set({
          name: payload.name || before.name,
          code: payload.code || before.code,
          displayType: payload.displayType || before.displayType,
          isVariantOption: payload.isVariantOption ?? before.isVariantOption,
          isRequired: payload.isRequired ?? before.isRequired,
          sortOrder: payload.sortOrder ?? before.sortOrder,
          isActive: payload.isActive ?? before.isActive,
          updatedAt: new Date()
        })
        .where(eq(productAttributes.id, id))
        .returning();
      await writeAuditLog({ actorId: session.userId, action: "update", entityType: "product_attribute", entityId: id, beforeData: before, afterData: item });
      return ok({ item, message: "تم تعديل الخاصية بنجاح" });
    }

    const [before] = await db.select().from(productAttributeValues).where(eq(productAttributeValues.id, id)).limit(1);
    const [item] = await db
      .update(productAttributeValues)
      .set({
        value: payload.value || before.value,
        code: payload.code === undefined ? before.code : payload.code || null,
        colorHex: payload.colorHex === undefined ? before.colorHex : payload.colorHex || null,
        imageUrl: payload.imageUrl === undefined ? before.imageUrl : payload.imageUrl || null,
        sortOrder: payload.sortOrder ?? before.sortOrder,
        isActive: payload.isActive ?? before.isActive,
        updatedAt: new Date()
      })
      .where(eq(productAttributeValues.id, id))
      .returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "product_attribute_value", entityId: id, beforeData: before, afterData: item });
    return ok({ item, message: "تم تعديل قيمة الخاصية بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر تعديل إعدادات الأصناف والمتغيرات");
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const kind = readKind(request);
    if (!kind) return fail("نوع العنصر مطلوب: category أو attribute أو value", 422);
    const storeId = await resolveStoreId(kind, id);
    if (!storeId) return fail("العنصر غير موجود", 404);
    const deny = await assertCanManage(session, storeId);
    if (deny) return fail(deny, 403);

    let item;
    if (kind === "category") [item] = await db.update(categories).set({ isActive: false, updatedAt: new Date() }).where(eq(categories.id, id)).returning();
    else if (kind === "attribute") [item] = await db.update(productAttributes).set({ isActive: false, updatedAt: new Date() }).where(eq(productAttributes.id, id)).returning();
    else [item] = await db.update(productAttributeValues).set({ isActive: false, updatedAt: new Date() }).where(eq(productAttributeValues.id, id)).returning();

    await writeAuditLog({ actorId: session.userId, action: "delete", entityType: `product_${kind}`, entityId: id, beforeData: { kind, storeId }, afterData: item });
    return ok({ message: "تم تعطيل العنصر بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حذف العنصر؛ قد توجد منتجات أو متغيرات مرتبطة به");
  }
}
