export const dynamic = "force-dynamic";

import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, inventoryStockCountLines, inventoryStockCounts, products, productVariants, storeOfferCollections } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { userHasStoreOperation } from "@/lib/rbac";

const schema = z.object({ title: z.string().trim().min(2).max(180).default("جرد دوري"), note: z.string().max(1_000).optional().nullable() });

async function merchantStore(userId: string) {
  const store = await getMerchantPrimaryStore(userId);
  if (!store) throw new Error("لا يوجد متجر مرتبط بالحساب");
  return store;
}

export async function GET() {
  try {
    const session = await requireAuth(); const store = await merchantStore(session.userId);
    if (!hasStoreAccess(session, store.id) || !(await userHasStoreOperation(session.userId, store.id, "inventory.stock_count"))) return fail("لا تملك صلاحية الجرد", 403);
    const counts = await db.select().from(inventoryStockCounts).where(eq(inventoryStockCounts.storeId, store.id)).orderBy(desc(inventoryStockCounts.createdAt)).limit(30);
    return ok({ counts });
  } catch (error) { return handleApiError(error, "تعذر تحميل جرد المخزون"); }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(); const store = await merchantStore(session.userId);
    if (!hasStoreAccess(session, store.id) || !(await userHasStoreOperation(session.userId, store.id, "inventory.stock_count"))) return fail("لا تملك صلاحية الجرد", 403);
    const payload = schema.parse(await request.json());
    const result = await db.transaction(async (tx) => {
      const [count] = await tx.insert(inventoryStockCounts).values({ storeId: store.id, title: payload.title, note: payload.note || null, status: "open", createdBy: session.userId }).returning();
      const variants = await tx.select({ variantId: productVariants.id, productId: products.id, expectedQuantity: productVariants.stockQuantity }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).leftJoin(storeOfferCollections, eq(storeOfferCollections.offerProductId, products.id)).where(and(eq(products.storeId, store.id), eq(productVariants.isActive, true), isNull(storeOfferCollections.id)));
      if (variants.length) await tx.insert(inventoryStockCountLines).values(variants.map((variant) => ({ stockCountId: count.id, variantId: variant.variantId, productId: variant.productId, expectedQuantity: variant.expectedQuantity })));
      return { count, linesCount: variants.length };
    });
    return created({ ...result, message: "تم فتح جرد جديد مع لقطة للمخزون الحالي" });
  } catch (error) { return handleApiError(error, "تعذر فتح جرد المخزون"); }
}
