import { eq, or } from "drizzle-orm";
import { db, storeOfferCollections } from "@/lib/db";

type DbLike = any;

/** Generated offer products represent assembled component inventory. Their
 * price and stock must move through the offer lifecycle, not generic product
 * editing or receiving flows. */
export async function assertNotGeneratedOfferInventory(input: { productId?: string | null; variantId?: string | null; tx?: DbLike }) {
  const tx = input.tx || db;
  if (!input.productId && !input.variantId) return;
  const conditions = [];
  if (input.productId) conditions.push(eq(storeOfferCollections.offerProductId, input.productId));
  if (input.variantId) conditions.push(eq(storeOfferCollections.offerVariantId, input.variantId));
  const [link] = await tx.select({ id: storeOfferCollections.id, title: storeOfferCollections.title }).from(storeOfferCollections).where(or(...conditions)!).limit(1);
  if (link) {
    const error = new Error(`هذا منتج عرض مخزني مرتبط بـ «${link.title}». استخدم نافذة العروض للتجميع أو التفكيك أو تعديل دورة المخزون.`) as Error & { statusCode?: number };
    error.statusCode = 409;
    throw error;
  }
}
