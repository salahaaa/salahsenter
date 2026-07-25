import { and, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { adminPromotionalOffers, db, offerCampaigns, storeOfferCollections, storeOfferItems, stores } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { inlineMediaSql } from "@/lib/inline-media";
import { filterVisibleBySchedule } from "@/lib/visibility-schedule";
import { cachedJson } from "./public-cache";
import { PUBLIC_CACHE_KEYS, PUBLIC_CACHE_TAGS, PUBLIC_CACHE_TTL } from "./cache-tags";

async function loadPublicOffersPageData() {
  if (!hasDatabase()) return { unavailable: true as const, offers: [], adminOffers: [] };
  const now = new Date();
  const [offers, adminOffers] = await Promise.all([
    db
      .select({
        id: storeOfferCollections.id,
        title: storeOfferCollections.title,
        description: storeOfferCollections.description,
        imageUrl: inlineMediaSql("storeOfferCollections", storeOfferCollections.id, "imageUrl", storeOfferCollections.imageUrl),
        startsAt: storeOfferCollections.startsAt,
        endsAt: storeOfferCollections.endsAt,
        isPromoted: storeOfferCollections.isPromoted,
        promotionPackage: storeOfferCollections.promotionPackage,
        visibilitySchedule: storeOfferCollections.visibilitySchedule,
        storeName: stores.name,
        storeSlug: stores.slug,
        campaignName: offerCampaigns.name,
        campaignSlug: offerCampaigns.slug,
        campaignType: offerCampaigns.occasionType,
        itemsCount: sql<number>`coalesce(sum(${storeOfferItems.quantity}), 0)::int`,
        originalTotal: sql<string>`coalesce(sum(${storeOfferItems.originalPrice} * ${storeOfferItems.quantity}), 0)::text`,
        offerTotal: sql<string>`coalesce(sum(${storeOfferItems.offerPrice} * ${storeOfferItems.quantity}), 0)::text`
      })
      .from(storeOfferCollections)
      .innerJoin(stores, eq(storeOfferCollections.storeId, stores.id))
      .leftJoin(offerCampaigns, eq(storeOfferCollections.campaignId, offerCampaigns.id))
      .leftJoin(storeOfferItems, eq(storeOfferItems.offerId, storeOfferCollections.id))
      .where(
        and(
          or(
            and(eq(storeOfferCollections.publicationTarget, "homepage"), eq(storeOfferCollections.publicationState, "homepage_approved")),
            and(isNull(storeOfferCollections.publicationTarget), eq(storeOfferCollections.status, "approved"))
          ),
          or(isNull(storeOfferCollections.offerProductId), sql`${storeOfferCollections.bundleRemainingQuantity} > 0`),
          eq(stores.status, "active"),
          eq(stores.isActive, true),
          or(isNull(storeOfferCollections.startsAt), lte(storeOfferCollections.startsAt, now)),
          or(isNull(storeOfferCollections.endsAt), gte(storeOfferCollections.endsAt, now)),
          or(isNull(offerCampaigns.id), and(eq(offerCampaigns.status, "active"), eq(offerCampaigns.isHomepageVisible, true)))
        )
      )
      .groupBy(storeOfferCollections.id, stores.id, offerCampaigns.id)
      .orderBy(desc(storeOfferCollections.isPromoted), desc(storeOfferCollections.createdAt))
      .limit(120),
    db
      .select({
        id: adminPromotionalOffers.id,
        title: adminPromotionalOffers.title,
        slug: adminPromotionalOffers.slug,
        category: adminPromotionalOffers.category,
        description: adminPromotionalOffers.description,
        imageUrl: inlineMediaSql("adminPromotionalOffers", adminPromotionalOffers.id, "imageUrl", adminPromotionalOffers.imageUrl),
        videoUrl: adminPromotionalOffers.videoUrl,
        contactName: adminPromotionalOffers.contactName,
        contactPhone: adminPromotionalOffers.contactPhone,
        whatsappUrl: adminPromotionalOffers.whatsappUrl,
        locationText: adminPromotionalOffers.locationText,
        externalUrl: adminPromotionalOffers.externalUrl,
        isFeatured: adminPromotionalOffers.isFeatured,
        visibilitySchedule: adminPromotionalOffers.visibilitySchedule,
        startsAt: adminPromotionalOffers.startsAt,
        endsAt: adminPromotionalOffers.endsAt,
        createdAt: adminPromotionalOffers.createdAt
      })
      .from(adminPromotionalOffers)
      .where(and(eq(adminPromotionalOffers.status, "active"), or(isNull(adminPromotionalOffers.startsAt), lte(adminPromotionalOffers.startsAt, now)), or(isNull(adminPromotionalOffers.endsAt), gte(adminPromotionalOffers.endsAt, now))))
      .orderBy(desc(adminPromotionalOffers.isFeatured), adminPromotionalOffers.sortOrder, desc(adminPromotionalOffers.createdAt))
      .limit(80)
  ]);

  return { unavailable: false as const, offers: filterVisibleBySchedule(offers, now), adminOffers: filterVisibleBySchedule(adminOffers, now) };
}

export async function getCachedPublicOffersPageData() {
  return cachedJson({
    key: PUBLIC_CACHE_KEYS.offersPage(),
    tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.offers, PUBLIC_CACHE_TAGS.stores, PUBLIC_CACHE_TAGS.products],
    ttlSeconds: PUBLIC_CACHE_TTL.offers,
    loader: loadPublicOffersPageData
  });
}
