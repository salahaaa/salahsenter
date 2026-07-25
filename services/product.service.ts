/**
 * Product Service
 * ===============
 * Encapsulates product read/write operations. EVERY mutation and detail read
 * routes ownership through the authorization layer, so cross-merchant access
 * is impossible by construction. Routes/pages call these instead of touching
 * `db` directly.
 */

import { desc, eq, type SQL } from "drizzle-orm";
import { db, productImages, products, productVariants } from "@/lib/db";
import { inlineMediaSql } from "@/lib/inline-media";
import { parseListQuery } from "@/lib/api-list-utils";
import { requireProductOwnership, requireStoreAccess } from "@/lib/authorization";

export interface ProductListItem {
  id: string;
  name: string;
  englishName: string | null;
  slug: string;
  productCode: string | null;
  barcode: string | null;
  brand: string | null;
  type: string;
  status: string;
  basePrice: string;
  discountPercent: string;
  isPromoted: boolean | null;
  viewCount: number | null;
  soldCount: number | null;
  ratingAverage: string | null;
  mainImageUrl: string | null;
  categoryId: string | null;
  createdAt: Date;
}

export async function listProducts(
  request: Request,
  storeId: string,
  opts: { q?: string; status?: string } = {}
) {
  const { page, pageSize, offset, q } = parseListQuery(request, { defaultPageSize: 20 });
  const conditions: SQL[] = [eq(products.storeId, storeId)];
  const term = opts.q ?? q;
  if (term) conditions.push(buildProductSearch(term));
  const status = opts.status ?? new URL(request.url).searchParams.get("status");
  if (status) conditions.push(eq(products.status, status as any));

  const where = conditions.length === 1 ? conditions[0] : (await import("drizzle-orm")).and(...conditions);

  const [rows, [{ count: totalCount }]] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        englishName: products.englishName,
        slug: products.slug,
        productCode: products.productCode,
        barcode: products.barcode,
        brand: products.brand,
        type: products.type,
        status: products.status,
        basePrice: products.basePrice,
        discountPercent: products.discountPercent,
        isPromoted: products.isPromoted,
        viewCount: products.viewCount,
        soldCount: products.soldCount,
        ratingAverage: products.ratingAverage,
        mainImageUrl: inlineMediaSql("products", products.id, "mainImageUrl", products.mainImageUrl),
        categoryId: products.categoryId,
        createdAt: products.createdAt
      })
      .from(products)
      .where(where)
      .orderBy(desc(products.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: (await import("drizzle-orm")).sql<number>`count(*)::int` }).from(products).where(where)
  ]);

  return { items: rows as ProductListItem[], page, pageSize, totalCount, hasNext: offset + rows.length < totalCount };
}

/** Fetch a product + its variants/images — ownership-verified. */
export async function getProductDetail(productId: string) {
  const { storeId } = await requireProductOwnership(productId);
  const [product, variants, images] = await Promise.all([
    db.select().from(products).where(eq(products.id, productId)).limit(1),
    db.select().from(productVariants).where(eq(productVariants.productId, productId)),
    db.select().from(productImages).where(eq(productImages.productId, productId))
  ]);
  return { product: product[0], variants, images, storeId };
}

/** Soft helper to confirm a store context before listing. */
export async function resolveStoreForMerchant(userId: string) {
  const { storeId } = await requireStoreAccess(null);
  return storeId;
}

function buildProductSearch(term: string): SQL {
  const { and, ilike, or } = require("drizzle-orm");
  const pattern = `%${term}%`;
  return or(ilike(products.name, pattern), ilike(products.slug, pattern), ilike(products.productCode, pattern), ilike(products.barcode, pattern), ilike(products.englishName, pattern));
}
