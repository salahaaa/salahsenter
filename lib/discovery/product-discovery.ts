import { and, desc, eq, ilike, inArray, isNotNull, ne, or, sql, type SQL } from "drizzle-orm";
import { categories, db, products, productVariants, stores } from "@/lib/db";
import { inlineRowMediaUrl } from "@/lib/inline-media";
import { cachedJson } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_KEYS, PUBLIC_CACHE_TAGS, PUBLIC_CACHE_TTL } from "@/lib/cache/cache-tags";
import { productTokens, scoreProductSimilarity, type ProductSimilarityInput } from "@/lib/discovery/product-similarity";

type CandidateRow = {
  product: typeof products.$inferSelect;
  store: Pick<typeof stores.$inferSelect, "id" | "name" | "slug" | "logoUrl" | "ratingAverage" | "ratingCount" | "orderCount" | "cityId">;
  categoryName: string | null;
  minPrice: string | null;
  inStock: boolean;
};

export type DiscoveryProduct = {
  id: string;
  name: string;
  slug: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  storeLogoUrl: string | null;
  imageUrl: string | null;
  minPrice: string | null;
  ratingAverage: string | number;
  ratingCount: number;
  inStock: boolean;
  confidence: "exact" | "strong" | "similar" | "weak";
  reasons: string[];
  href: string;
};

export type ProductDiscovery = {
  similarProducts: DiscoveryProduct[];
  sameItemStores: DiscoveryProduct[];
  alternativeStores: DiscoveryProduct[];
  insight: string | null;
};

const emptyDiscovery: ProductDiscovery = { similarProducts: [], sameItemStores: [], alternativeStores: [], insight: null };

function publicProductCondition() {
  return and(eq(products.status, "active"), eq(stores.status, "active"), eq(stores.isActive, true), sql`${products.showcaseStatus} <> 'HIDDEN'`);
}

function uniqueByStore(rows: DiscoveryProduct[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.storeId)) return false;
    seen.add(row.storeId);
    return true;
  });
}

function candidateCard(row: CandidateRow, similarity: ReturnType<typeof scoreProductSimilarity>): DiscoveryProduct {
  return {
    id: row.product.id,
    name: row.product.name,
    slug: row.product.slug,
    storeId: row.store.id,
    storeName: row.store.name,
    storeSlug: row.store.slug,
    storeLogoUrl: inlineRowMediaUrl("stores", row.store.id, "logoUrl", row.store.logoUrl),
    imageUrl: inlineRowMediaUrl("products", row.product.id, "mainImageUrl", row.product.mainImageUrl),
    minPrice: row.minPrice,
    ratingAverage: row.product.ratingAverage,
    ratingCount: row.product.ratingCount,
    inStock: row.inStock,
    confidence: similarity.confidence,
    reasons: similarity.reasons,
    href: `/store/${row.store.slug}/products/${row.product.slug}`
  };
}

async function loadProductDiscovery(productId: string): Promise<ProductDiscovery> {
  const [referenceRow] = await db
    .select({ product: products, store: stores, categoryName: categories.name })
    .from(products)
    .innerJoin(stores, eq(products.storeId, stores.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.id, productId), publicProductCondition()))
    .limit(1);
  if (!referenceRow) return emptyDiscovery;

  const referenceVariants = await db
    .select({ barcode: productVariants.barcode })
    .from(productVariants)
    .where(and(eq(productVariants.productId, referenceRow.product.id), eq(productVariants.isActive, true), isNotNull(productVariants.barcode)));
  const barcodes = [referenceRow.product.barcode, ...referenceVariants.map((row) => row.barcode)].filter((value): value is string => Boolean(value?.trim()));
  const nameTokens = productTokens(`${referenceRow.product.name} ${referenceRow.product.englishName || ""}`).slice(0, 5);
  const relevance: SQL[] = [];
  if (referenceRow.categoryName) relevance.push(ilike(categories.name, `%${referenceRow.categoryName}%`));
  if (referenceRow.product.brand) relevance.push(ilike(products.brand, referenceRow.product.brand));
  relevance.push(...nameTokens.map((token) => ilike(products.name, `%${token}%`)));
  if (barcodes.length) {
    relevance.push(or(inArray(products.barcode, barcodes), sql`exists (select 1 from ${productVariants} where ${productVariants.productId} = ${products.id} and ${productVariants.isActive} = true and ${inArray(productVariants.barcode, barcodes)})`)!);
  }
  if (!relevance.length) return emptyDiscovery;

  const candidates = await db
    .select({
      product: products,
      store: {
        id: stores.id,
        name: stores.name,
        slug: stores.slug,
        logoUrl: stores.logoUrl,
        ratingAverage: stores.ratingAverage,
        ratingCount: stores.ratingCount,
        orderCount: stores.orderCount,
        cityId: stores.cityId
      },
      categoryName: categories.name,
      minPrice: sql<string | null>`(select min(${productVariants.price}) from ${productVariants} where ${productVariants.productId} = ${products.id} and ${productVariants.isActive} = true)`,
      inStock: sql<boolean>`exists (select 1 from ${productVariants} where ${productVariants.productId} = ${products.id} and ${productVariants.isActive} = true and ${productVariants.stockQuantity} > 0)`
    })
    .from(products)
    .innerJoin(stores, eq(products.storeId, stores.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(publicProductCondition(), ne(products.id, referenceRow.product.id), sql`exists (select 1 from ${productVariants} where ${productVariants.productId} = ${products.id} and ${productVariants.isActive} = true and ${productVariants.stockQuantity} > 0)`, or(...relevance)))
    .orderBy(desc(products.ratingAverage), desc(products.soldCount), desc(products.createdAt))
    .limit(120) as CandidateRow[];
  if (!candidates.length) return emptyDiscovery;

  const candidateIds = candidates.map((row) => row.product.id);
  const barcodeRows = await db
    .select({ productId: productVariants.productId, barcode: productVariants.barcode })
    .from(productVariants)
    .where(and(inArray(productVariants.productId, candidateIds), eq(productVariants.isActive, true), isNotNull(productVariants.barcode)));
  const candidateBarcodes = new Map<string, string[]>();
  for (const row of barcodeRows) candidateBarcodes.set(row.productId, [...(candidateBarcodes.get(row.productId) || []), row.barcode!]);

  const reference: ProductSimilarityInput = {
    id: referenceRow.product.id,
    storeId: referenceRow.store.id,
    name: referenceRow.product.name,
    englishName: referenceRow.product.englishName,
    brand: referenceRow.product.brand,
    categoryName: referenceRow.categoryName,
    barcode: referenceRow.product.barcode,
    variantBarcodes: referenceVariants.map((row) => row.barcode!).filter(Boolean),
    inStock: true
  };
  const ranked = candidates
    .map((candidate) => {
      const similarity = scoreProductSimilarity(reference, {
        id: candidate.product.id,
        storeId: candidate.store.id,
        name: candidate.product.name,
        englishName: candidate.product.englishName,
        brand: candidate.product.brand,
        categoryName: candidate.categoryName,
        barcode: candidate.product.barcode,
        variantBarcodes: candidateBarcodes.get(candidate.product.id) || [],
        inStock: Boolean(candidate.inStock)
      });
      return { candidate, similarity, card: candidateCard(candidate, similarity) };
    })
    .filter((row) => row.similarity.score >= 32)
    .sort((a, b) => b.similarity.score - a.similarity.score || Number(b.candidate.product.ratingAverage || 0) - Number(a.candidate.product.ratingAverage || 0) || b.candidate.product.soldCount - a.candidate.product.soldCount);

  const similarProducts = ranked.slice(0, 8).map((row) => row.card);
  const sameItemStores = uniqueByStore(ranked
    .filter((row) => row.candidate.store.id !== referenceRow.store.id && (row.similarity.confidence === "exact" || row.similarity.confidence === "strong"))
    .map((row) => row.card))
    .slice(0, 6);
  const sameItemStoreIds = new Set(sameItemStores.map((row) => row.storeId));
  const alternativeStores = uniqueByStore(ranked
    .filter((row) => row.candidate.store.id !== referenceRow.store.id && !sameItemStoreIds.has(row.candidate.store.id) && row.similarity.score >= 48)
    .map((row) => row.card))
    .slice(0, 6);

  const insight = sameItemStores.length
    ? `وجدنا ${sameItemStores.length} متجرًا يقدم نفس الصنف أو تطابقًا قويًا.`
    : alternativeStores.length
      ? `لم نجد تطابقًا مؤكدًا بالباركود؛ هذه بدائل قريبة من متاجر أخرى.`
      : null;
  return { similarProducts, sameItemStores, alternativeStores, insight };
}

export async function getCachedProductDiscovery(productId: string) {
  return cachedJson({
    key: PUBLIC_CACHE_KEYS.productDiscovery(productId),
    tags: [PUBLIC_CACHE_TAGS.products, PUBLIC_CACHE_TAGS.stores],
    ttlSeconds: PUBLIC_CACHE_TTL.product,
    loader: () => loadProductDiscovery(productId)
  });
}
