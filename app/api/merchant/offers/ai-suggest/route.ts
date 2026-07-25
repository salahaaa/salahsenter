export const dynamic = "force-dynamic";

import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { categories, db, productVariants, products } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";
import { suggestBundleOffer } from "@/lib/ai/merchant-bundle-suggester";

const schema = z.object({
  prompt: z.string().min(2),
  targetDiscountPercent: z.coerce.number().min(0).max(80).optional().nullable(),
  maxItems: z.coerce.number().int().min(2).max(8).optional().default(4)
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, store.id, [Permission.ManageStoreOffers, Permission.ManageAnnouncements]))) return fail("لا تملك صلاحية عروض المتجر", 403);

    const rows = await db
      .select({
        productId: products.id,
        name: products.name,
        basePrice: products.basePrice,
        variantId: productVariants.id,
        variantPrice: productVariants.price,
        stockQuantity: productVariants.stockQuantity,
        categoryName: categories.name
      })
      .from(products)
      .innerJoin(productVariants, eq(productVariants.productId, products.id))
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(and(eq(products.storeId, store.id), eq(products.status, "active"), eq(productVariants.isActive, true)))
      .orderBy(desc(productVariants.stockQuantity), desc(products.createdAt))
      .limit(500);

    const productsForAi = rows.map((row) => ({
      productId: row.productId,
      variantId: row.variantId,
      name: row.name,
      price: Number(row.variantPrice || row.basePrice || 0),
      stockQuantity: Number(row.stockQuantity || 0),
      categoryName: row.categoryName
    }));

    const suggestion = suggestBundleOffer({ prompt: payload.prompt, products: productsForAi, targetDiscountPercent: payload.targetDiscountPercent, maxItems: payload.maxItems });
    return ok({ suggestion, message: "تم توليد اقتراح العرض الذكي" });
  } catch (error) {
    return handleApiError(error, "تعذر توليد اقتراح العرض الذكي");
  }
}
