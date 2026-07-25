import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { getStoreCurrencySettings } from "@/lib/currency";
import { db, productAttributeValues, productAttributes, productImages, products, productVariantAttributeValues, productVariants, stores } from "@/lib/db";
import { inlineRowMediaArray, inlineRowMediaUrl } from "@/lib/inline-media";
import { cachedJson } from "./public-cache";
import { PUBLIC_CACHE_KEYS, PUBLIC_CACHE_TAGS, PUBLIC_CACHE_TTL } from "./cache-tags";

async function loadPublicProductPageData(storeSlug: string, productSlug: string, preview = false) {
  const conditions = preview
    ? and(eq(stores.slug, storeSlug), eq(products.slug, productSlug))
    : and(eq(stores.slug, storeSlug), eq(products.slug, productSlug), eq(products.status, "active"), eq(stores.status, "active"), eq(stores.isActive, true), sql`${products.showcaseStatus} <> 'HIDDEN'`, or(isNull(products.publishAt), lte(products.publishAt, new Date())), or(isNull(products.unpublishAt), gte(products.unpublishAt, new Date())));

  const [row] = await db
    .select({ product: products, store: stores })
    .from(products)
    .innerJoin(stores, eq(products.storeId, stores.id))
    .where(conditions)
    .limit(1);

  if (!row) return null;

  const currencySettings = await getStoreCurrencySettings(row.store.id);
  const [variants, images, optionRows] = await Promise.all([
    db.select().from(productVariants).where(preview ? eq(productVariants.productId, row.product.id) : and(eq(productVariants.productId, row.product.id), eq(productVariants.isActive, true))),
    db.select().from(productImages).where(eq(productImages.productId, row.product.id)),
    db
      .select({ attributeName: productAttributes.name, valueId: productAttributeValues.id, value: productAttributeValues.value, colorHex: productAttributeValues.colorHex, imageUrl: productAttributeValues.imageUrl })
      .from(productVariantAttributeValues)
      .innerJoin(productAttributeValues, eq(productVariantAttributeValues.valueId, productAttributeValues.id))
      .innerJoin(productAttributes, eq(productVariantAttributeValues.attributeId, productAttributes.id))
      .innerJoin(productVariants, eq(productVariantAttributeValues.variantId, productVariants.id))
      .where(eq(productVariants.productId, row.product.id))
  ]);

  const publicProduct = {
    ...row.product,
    mainImageUrl: inlineRowMediaUrl("products", row.product.id, "mainImageUrl", row.product.mainImageUrl),
    images: inlineRowMediaArray("products", row.product.id, "images", row.product.images)
  };

  const publicVariants = variants.map((variant) => ({
    ...variant,
    imageUrl: inlineRowMediaUrl("productVariants", variant.id, "imageUrl", variant.imageUrl),
    images: inlineRowMediaArray("productVariants", variant.id, "images", variant.images)
  }));

  const publicImages = images.map((image) => ({
    ...image,
    url: inlineRowMediaUrl("productImages", image.id, "url", image.url) || image.url
  }));

  const colorMap = optionRows.reduce<Record<string, string>>((acc, option) => {
    if (option.colorHex) {
      acc[option.value] = option.colorHex;
      acc[`${option.attributeName}:${option.value}`] = option.colorHex;
    }
    return acc;
  }, {});

  const valueImageMap = optionRows.reduce<Record<string, string>>((acc, option) => {
    if (option.imageUrl) {
      const resolved = inlineRowMediaUrl("productAttributeValues", option.valueId, "imageUrl", option.imageUrl) || option.imageUrl;
      acc[option.value] = resolved;
      acc[`${option.attributeName}:${option.value}`] = resolved;
    }
    return acc;
  }, {});

  return { product: publicProduct, variants: publicVariants, images: publicImages, store: row.store, colorMap, valueImageMap, currencySettings };
}

export async function getCachedPublicProductPageData(storeSlug: string, productSlug: string) {
  return cachedJson({
    key: PUBLIC_CACHE_KEYS.productPage(storeSlug, productSlug),
    tags: [PUBLIC_CACHE_TAGS.products, PUBLIC_CACHE_TAGS.stores, PUBLIC_CACHE_TAGS.storeSlug(storeSlug), PUBLIC_CACHE_TAGS.productSlug(storeSlug, productSlug)],
    ttlSeconds: PUBLIC_CACHE_TTL.product,
    loader: () => loadPublicProductPageData(storeSlug, productSlug, false)
  });
}

export async function getFreshPreviewProductPageData(storeSlug: string, productSlug: string) {
  return loadPublicProductPageData(storeSlug, productSlug, true);
}
