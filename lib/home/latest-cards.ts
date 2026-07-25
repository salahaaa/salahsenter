export type HomeCardRecord = Record<string, any>;

/**
 * Builds the "latest additions" cards without fabricating duplicate wing
 * records when the homepage is running on its empty-catalogue fallback.
 */
export function buildLatestHomeCards(
  data: { latestAdditions?: HomeCardRecord[]; trendingProducts?: HomeCardRecord[] },
  wings: HomeCardRecord[],
  productFallbackImages: string[]
): HomeCardRecord[] {
  const sourceProducts = data.latestAdditions?.length ? data.latestAdditions : data.trendingProducts || [];
  const products = sourceProducts.slice(0, 6).map((product, index) => ({
    id: product.id,
    kind: "product",
    name: product.name,
    slug: product.slug,
    storeSlug: product.storeSlug,
    storeName: product.storeName,
    description: product.storeName || "أحدث الإضافات من المتاجر المعتمدة",
    heroImageUrl: product.mainImageUrl || productFallbackImages[index % productFallbackImages.length],
    productCount: product.soldCount || index + 1,
    ratingAverage: product.ratingAverage || 4.2
  }));

  // `wings` is already the single source of the fallback wings when the DB
  // has no published wings. Do not concatenate fallback data again: duplicate
  // records produce repeated cards and duplicate React keys.
  return products.length ? products : uniqueHomeRecordsById(wings).slice(0, 6);
}

export function uniqueHomeRecordsById(records: HomeCardRecord[]): HomeCardRecord[] {
  const seen = new Set<string>();
  return records.filter((record, index) => {
    const key = String(record.id || record.slug || `item-${index}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
