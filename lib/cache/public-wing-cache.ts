import { and, desc, eq, or } from "drizzle-orm";
import { cities, countries, db, governorates, products, stores, storeWings, wings } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { inlineMediaSql, inlineRowMediaUrl } from "@/lib/inline-media";
import { cachedJson } from "./public-cache";
import { PUBLIC_CACHE_KEYS, PUBLIC_CACHE_TAGS, PUBLIC_CACHE_TTL } from "./cache-tags";

type WingRow = typeof wings.$inferSelect;

async function loadPublicWingPageData(slug: string) {
  if (!hasDatabase()) return { unavailable: true as const };

  let wing: WingRow | null = null;
  [wing] = await db.select().from(wings).where(and(eq(wings.slug, slug), eq(wings.isActive, true))).limit(1);
  if (!wing) return null;

  wing = {
    ...wing,
    iconUrl: inlineRowMediaUrl("wings", wing.id, "iconUrl", wing.iconUrl),
    heroImageUrl: inlineRowMediaUrl("wings", wing.id, "heroImageUrl", wing.heroImageUrl),
    mobileImageUrl: inlineRowMediaUrl("wings", wing.id, "mobileImageUrl", wing.mobileImageUrl),
    desktopImageUrl: inlineRowMediaUrl("wings", wing.id, "desktopImageUrl", wing.desktopImageUrl)
  };

  const storeRows = await db
    .select({
      id: stores.id,
      name: stores.name,
      slug: stores.slug,
      coverImageUrl: inlineMediaSql("stores", stores.id, "coverImageUrl", stores.coverImageUrl),
      logoUrl: inlineMediaSql("stores", stores.id, "logoUrl", stores.logoUrl),
      ratingAverage: stores.ratingAverage,
      orderCount: stores.orderCount,
      countryName: countries.name,
      governorateName: governorates.name,
      cityName: cities.name,
      createdAt: stores.createdAt
    })
    .from(stores)
    .leftJoin(storeWings, eq(stores.id, storeWings.storeId))
    .leftJoin(countries, eq(stores.countryId, countries.id))
    .leftJoin(governorates, eq(stores.governorateId, governorates.id))
    .leftJoin(cities, eq(stores.cityId, cities.id))
    .where(and(eq(stores.status, "active"), eq(stores.isActive, true), or(eq(stores.primaryWingId, wing.id), eq(storeWings.wingId, wing.id))))
    .orderBy(desc(stores.salesTotal), desc(stores.orderCount), desc(stores.ratingAverage))
    .limit(48);

  const seen = new Set<string>();
  const wingStores = storeRows.filter((store) => {
    if (seen.has(store.id)) return false;
    seen.add(store.id);
    return true;
  });

  const wingProducts = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      mainImageUrl: inlineMediaSql("products", products.id, "mainImageUrl", products.mainImageUrl),
      basePrice: products.basePrice,
      ratingAverage: products.ratingAverage,
      soldCount: products.soldCount,
      storeName: stores.name,
      storeSlug: stores.slug
    })
    .from(products)
    .innerJoin(stores, eq(products.storeId, stores.id))
    .leftJoin(storeWings, eq(stores.id, storeWings.storeId))
    .where(and(eq(products.status, "active"), eq(stores.status, "active"), eq(stores.isActive, true), or(eq(stores.primaryWingId, wing.id), eq(storeWings.wingId, wing.id))))
    .orderBy(desc(products.soldCount), desc(products.viewCount), desc(products.ratingAverage))
    .limit(24);

  return { wing, wingStores, wingProducts };
}

export async function getCachedPublicWingPageData(slug: string) {
  return cachedJson({
    key: PUBLIC_CACHE_KEYS.wingPage(slug),
    tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.wings, PUBLIC_CACHE_TAGS.stores, PUBLIC_CACHE_TAGS.products, PUBLIC_CACHE_TAGS.wingSlug(slug)],
    ttlSeconds: PUBLIC_CACHE_TTL.wing,
    loader: () => loadPublicWingPageData(slug)
  });
}
