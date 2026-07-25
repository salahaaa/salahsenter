export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, products } from "@/lib/db";
import { getProductQuality } from "@/lib/products/lifecycle";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const [product] = await db.select({ storeId: products.storeId }).from(products).where(eq(products.id, id)).limit(1);
    if (!product) return fail("المنتج غير موجود", 404);
    if (!hasStoreAccess(session, product.storeId)) return fail("لا تملك صلاحية هذا المنتج", 403);
    return ok({ quality: await getProductQuality(id) });
  } catch (error) {
    return handleApiError(error, "تعذر احتساب جودة الكتالوج");
  }
}
