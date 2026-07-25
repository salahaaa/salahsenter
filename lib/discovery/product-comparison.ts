import { and, eq, inArray, sql } from "drizzle-orm";
import { categories, db, products, productVariants, stores } from "@/lib/db";
import { inlineRowMediaUrl } from "@/lib/inline-media";
import { cachedJson } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_KEYS, PUBLIC_CACHE_TAGS, PUBLIC_CACHE_TTL } from "@/lib/cache/cache-tags";

type ComparisonSource = {
  product: typeof products.$inferSelect;
  store: Pick<typeof stores.$inferSelect, "id" | "name" | "slug" | "logoUrl" | "ratingAverage" | "ratingCount" | "cityId">;
  categoryName: string | null;
  minPrice: string | null;
  maxPrice: string | null;
  inStock: boolean;
};

export type PublicComparisonProduct = {
  id: string;
  name: string;
  slug: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  storeLogoUrl: string | null;
  imageUrl: string | null;
  minPrice: string | null;
  maxPrice: string | null;
  ratingAverage: string | number;
  ratingCount: number;
  inStock: boolean;
  href: string;
};

export type ComparisonRow = { key: string; label: string; values: Record<string, string> };

export type PublicProductComparison = {
  products: PublicComparisonProduct[];
  rows: ComparisonRow[];
  note: string;
};

function publicCondition() {
  return and(eq(products.status, "active"), eq(stores.status, "active"), eq(stores.isActive, true), sql`${products.showcaseStatus} <> 'HIDDEN'`);
}

function normalizedKey(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function valueOrDash(value: string | null | undefined) {
  return value?.trim() || "—";
}

function priceLabel(row: PublicComparisonProduct) {
  if (!row.minPrice) return "حسب المتغير";
  return row.maxPrice && row.maxPrice !== row.minPrice ? `${row.minPrice} – ${row.maxPrice}` : row.minPrice;
}

export function buildComparisonRows(productsToCompare: Array<PublicComparisonProduct & { categoryName?: string | null; brand?: string | null; warranty?: string | null; originCountry?: string | null; specifications?: Record<string, string> }>): ComparisonRow[] {
  const baseRows: ComparisonRow[] = [
    { key: "store", label: "المتجر", values: Object.fromEntries(productsToCompare.map((item) => [item.id, item.storeName])) },
    { key: "category", label: "الفئة", values: Object.fromEntries(productsToCompare.map((item) => [item.id, valueOrDash(item.categoryName)])) },
    { key: "brand", label: "العلامة التجارية", values: Object.fromEntries(productsToCompare.map((item) => [item.id, valueOrDash(item.brand)])) },
    { key: "price", label: "السعر الأساسي", values: Object.fromEntries(productsToCompare.map((item) => [item.id, priceLabel(item)])) },
    { key: "availability", label: "التوفر", values: Object.fromEntries(productsToCompare.map((item) => [item.id, item.inStock ? "متوفر" : "غير متوفر حاليًا"])) },
    { key: "rating", label: "التقييم", values: Object.fromEntries(productsToCompare.map((item) => [item.id, `${Number(item.ratingAverage || 0).toFixed(1)} (${item.ratingCount})`])) },
    { key: "warranty", label: "الضمان", values: Object.fromEntries(productsToCompare.map((item) => [item.id, valueOrDash(item.warranty)])) },
    { key: "origin", label: "بلد المنشأ", values: Object.fromEntries(productsToCompare.map((item) => [item.id, valueOrDash(item.originCountry)])) }
  ];

  const specificationLabels = new Map<string, string>();
  for (const item of productsToCompare) {
    for (const key of Object.keys(item.specifications || {})) specificationLabels.set(normalizedKey(key), key.trim());
  }
  const specificationRows = [...specificationLabels.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ar"))
    .map(([key, label]) => ({
      key: `spec:${key}`,
      label,
      values: Object.fromEntries(productsToCompare.map((item) => {
        const sourceEntry = Object.entries(item.specifications || {}).find(([specification]) => normalizedKey(specification) === key);
        return [item.id, valueOrDash(sourceEntry?.[1])];
      }))
    }));
  return [...baseRows, ...specificationRows];
}

async function loadPublicProductComparison(ids: string[]): Promise<PublicProductComparison> {
  const uniqueIds = [...new Set(ids)].slice(0, 4);
  if (uniqueIds.length < 2) return { products: [], rows: [], note: "اختر منتجين على الأقل للمقارنة." };
  const sourceRows = await db
    .select({
      product: products,
      store: { id: stores.id, name: stores.name, slug: stores.slug, logoUrl: stores.logoUrl, ratingAverage: stores.ratingAverage, ratingCount: stores.ratingCount, cityId: stores.cityId },
      categoryName: categories.name,
      minPrice: sql<string | null>`(select min(${productVariants.price}) from ${productVariants} where ${productVariants.productId} = ${products.id} and ${productVariants.isActive} = true)`,
      maxPrice: sql<string | null>`(select max(${productVariants.price}) from ${productVariants} where ${productVariants.productId} = ${products.id} and ${productVariants.isActive} = true)`,
      inStock: sql<boolean>`exists (select 1 from ${productVariants} where ${productVariants.productId} = ${products.id} and ${productVariants.isActive} = true and ${productVariants.stockQuantity} > 0)`
    })
    .from(products)
    .innerJoin(stores, eq(products.storeId, stores.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(publicCondition(), inArray(products.id, uniqueIds))) as ComparisonSource[];

  const byId = new Map(sourceRows.map((row) => [row.product.id, row]));
  const compared = uniqueIds.flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    return [{
      id: row.product.id,
      name: row.product.name,
      slug: row.product.slug,
      storeId: row.store.id,
      storeName: row.store.name,
      storeSlug: row.store.slug,
      storeLogoUrl: inlineRowMediaUrl("stores", row.store.id, "logoUrl", row.store.logoUrl),
      imageUrl: inlineRowMediaUrl("products", row.product.id, "mainImageUrl", row.product.mainImageUrl),
      minPrice: row.minPrice,
      maxPrice: row.maxPrice,
      ratingAverage: row.product.ratingAverage,
      ratingCount: row.product.ratingCount,
      inStock: Boolean(row.inStock),
      href: `/store/${row.store.slug}/products/${row.product.slug}`,
      categoryName: row.categoryName,
      brand: row.product.brand,
      warranty: row.product.warranty,
      originCountry: row.product.originCountry,
      specifications: row.product.specifications
    }];
  });
  return {
    products: compared.map(({ categoryName: _categoryName, brand: _brand, warranty: _warranty, originCountry: _originCountry, specifications: _specifications, ...product }) => product),
    rows: buildComparisonRows(compared),
    note: "قارن المواصفات والتوفر والضمان قبل الشراء؛ السعر المعروض هو السعر الأساسي وقد تختلف رسوم الشحن."
  };
}

export async function getCachedPublicProductComparison(ids: string[]) {
  const uniqueIds = [...new Set(ids)].slice(0, 4);
  return cachedJson({
    key: PUBLIC_CACHE_KEYS.productComparison(uniqueIds),
    tags: [PUBLIC_CACHE_TAGS.products, PUBLIC_CACHE_TAGS.stores],
    ttlSeconds: PUBLIC_CACHE_TTL.product,
    loader: () => loadPublicProductComparison(uniqueIds)
  });
}
