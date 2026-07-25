export const dynamic = "force-dynamic";

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { categories, db, productAttributes, productAttributeValues } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";
import { suggestProductDraft } from "@/lib/ai/product-copy-suggester";

const schema = z.object({ prompt: z.string().min(2) });

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, store.id, [Permission.ManageProducts, Permission.ManageProductTaxonomy, Permission.ManageStoreSettings]))) return fail("لا تملك صلاحية مساعدة المنتجات", 403);

    const [categoryRows, attributeRows] = await Promise.all([
      db.select({ id: categories.id, name: categories.name, code: categories.code }).from(categories).where(eq(categories.storeId, store.id)),
      db.select({ id: productAttributes.id, name: productAttributes.name, code: productAttributes.code }).from(productAttributes).where(eq(productAttributes.storeId, store.id))
    ]);
    const attrIds = attributeRows.map((attr) => attr.id);
    const valueRows = attrIds.length ? await db.select({ id: productAttributeValues.id, attributeId: productAttributeValues.attributeId, value: productAttributeValues.value, code: productAttributeValues.code }).from(productAttributeValues).where(inArray(productAttributeValues.attributeId, attrIds)) : [];
    const attributes = attributeRows.map((attr) => ({ ...attr, values: valueRows.filter((value) => value.attributeId === attr.id) }));
    return ok({ suggestion: suggestProductDraft({ prompt: payload.prompt, categories: categoryRows, attributes }) });
  } catch (error) {
    return handleApiError(error, "تعذر توليد اقتراح المنتج");
  }
}
