import { and, desc, eq, gt, gte, isNull, lte, or, sql } from "drizzle-orm";
import { getStoreCurrencySettings } from "@/lib/currency";
import { db, products, storeOfferCollections, storeOfferItems } from "@/lib/db";
import { getPublicStore } from "@/lib/db/queries";
import { getStoreDesignSettings } from "@/lib/enterprise/store-ai-setup";
import { inlineMediaSql } from "@/lib/inline-media";
import { filterVisibleBySchedule } from "@/lib/visibility-schedule";
import { cachedJson } from "./public-cache";
import { PUBLIC_CACHE_KEYS, PUBLIC_CACHE_TAGS, PUBLIC_CACHE_TTL } from "./cache-tags";

async function loadPublicStorePageData(slug: string, preview = false) {
  const data = await getPublicStore(slug, { preview });
  if (!data) return null;

  const now = new Date();
  const [currencySettings, storeDesign, storeOffers] = await Promise.all([
    getStoreCurrencySettings(data.store.id),
    getStoreDesignSettings(data.store.id),
    db
      .select({
        id: storeOfferCollections.id,
        title: storeOfferCollections.title,
        description: storeOfferCollections.description,
        imageUrl: inlineMediaSql("storeOfferCollections", storeOfferCollections.id, "imageUrl", storeOfferCollections.imageUrl),
        isPromoted: storeOfferCollections.isPromoted,
        publicationTarget: storeOfferCollections.publicationTarget,
        publicationState: storeOfferCollections.publicationState,
        visibilitySchedule: storeOfferCollections.visibilitySchedule,
        offerProductId: storeOfferCollections.offerProductId,
        offerProductSlug: products.slug,
        bundleRemainingQuantity: storeOfferCollections.bundleRemainingQuantity,
        startsAt: storeOfferCollections.startsAt,
        endsAt: storeOfferCollections.endsAt
      })
      .from(storeOfferCollections)
      .leftJoin(products, eq(storeOfferCollections.offerProductId, products.id))
      .where(
        and(
          eq(storeOfferCollections.storeId, data.store.id),
          preview ? eq(storeOfferCollections.storeId, data.store.id) : or(
            and(eq(storeOfferCollections.publicationTarget, "storefront"), eq(storeOfferCollections.publicationState, "storefront_live")),
            and(eq(storeOfferCollections.publicationTarget, "homepage"), eq(storeOfferCollections.publicationState, "homepage_approved")),
            and(isNull(storeOfferCollections.publicationTarget), eq(storeOfferCollections.status, "approved"))
          ),
          preview ? sql`true` : or(isNull(storeOfferCollections.offerProductId), gt(storeOfferCollections.bundleRemainingQuantity, 0)),
          or(isNull(storeOfferCollections.startsAt), lte(storeOfferCollections.startsAt, now)),
          or(isNull(storeOfferCollections.endsAt), gte(storeOfferCollections.endsAt, now))
        )
      )
      .orderBy(desc(storeOfferCollections.isPromoted), desc(storeOfferCollections.createdAt))
      .limit(12)
  ]);

  return { ...data, currencySettings, storeDesign, storeOffers: preview ? storeOffers : filterVisibleBySchedule(storeOffers, now) };
}

async function loadStoreSelectedOffer(storeId: string, offerId: string, preview = false) {
  if (!offerId) return [];
  const now = new Date();
  return db
    .select({
      offer: { id: storeOfferCollections.id, title: storeOfferCollections.title, description: storeOfferCollections.description },
      item: {
        id: storeOfferItems.id,
        title: storeOfferItems.title,
        imageUrl: inlineMediaSql("storeOfferItems", storeOfferItems.id, "imageUrl", storeOfferItems.imageUrl),
        originalPrice: storeOfferItems.originalPrice,
        offerPrice: storeOfferItems.offerPrice
      },
      product: {
        id: products.id,
        name: products.name,
        slug: products.slug,
        mainImageUrl: inlineMediaSql("products", products.id, "mainImageUrl", products.mainImageUrl),
        basePrice: products.basePrice
      }
    })
    .from(storeOfferCollections)
    .innerJoin(storeOfferItems, eq(storeOfferItems.offerId, storeOfferCollections.id))
    .innerJoin(products, eq(storeOfferItems.productId, products.id))
    .where(and(
      eq(storeOfferCollections.id, offerId),
      eq(storeOfferCollections.storeId, storeId),
      preview ? eq(storeOfferCollections.storeId, storeId) : or(
        and(eq(storeOfferCollections.publicationTarget, "storefront"), eq(storeOfferCollections.publicationState, "storefront_live")),
        and(eq(storeOfferCollections.publicationTarget, "homepage"), eq(storeOfferCollections.publicationState, "homepage_approved")),
        and(isNull(storeOfferCollections.publicationTarget), eq(storeOfferCollections.status, "approved"))
      ),
      preview ? sql`true` : or(isNull(storeOfferCollections.offerProductId), gt(storeOfferCollections.bundleRemainingQuantity, 0)),
      or(isNull(storeOfferCollections.startsAt), lte(storeOfferCollections.startsAt, now)),
      or(isNull(storeOfferCollections.endsAt), gte(storeOfferCollections.endsAt, now))
    ));
}

export async function getCachedPublicStorePageData(slug: string) {
  return cachedJson({
    key: PUBLIC_CACHE_KEYS.storePage(slug),
    tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.stores, PUBLIC_CACHE_TAGS.products, PUBLIC_CACHE_TAGS.offers, PUBLIC_CACHE_TAGS.storeSlug(slug)],
    ttlSeconds: PUBLIC_CACHE_TTL.store,
    loader: () => loadPublicStorePageData(slug, false)
  });
}

export async function getFreshPreviewStorePageData(slug: string) {
  return loadPublicStorePageData(slug, true);
}

export async function getCachedStoreSelectedOffer(storeId: string, storeSlug: string, offerId: string) {
  return cachedJson({
    key: `${PUBLIC_CACHE_KEYS.storePage(storeSlug)}:offer:${encodeURIComponent(offerId)}`,
    tags: [PUBLIC_CACHE_TAGS.offers, PUBLIC_CACHE_TAGS.storeSlug(storeSlug)],
    ttlSeconds: PUBLIC_CACHE_TTL.offers,
    loader: () => loadStoreSelectedOffer(storeId, offerId, false)
  });
}

export async function getFreshPreviewStoreSelectedOffer(storeId: string, offerId: string) {
  return loadStoreSelectedOffer(storeId, offerId, true);
}
