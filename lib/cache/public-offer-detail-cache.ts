import { and, eq, gte, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { adminPromotionalOffers, db, offerCampaigns, products, productVariants, storeOfferCollections, storeOfferItems, stores } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { inlineMediaSql } from "@/lib/inline-media";
import { cachedJson } from "./public-cache";
import { isVisibleBySchedule } from "@/lib/visibility-schedule";
import { PUBLIC_CACHE_TAGS, PUBLIC_CACHE_TTL } from "./cache-tags";

async function loadMerchantOffer(id: string) {
  const now = new Date();
  const [row] = await db
    .select({ offer: storeOfferCollections, store: stores, campaign: offerCampaigns })
    .from(storeOfferCollections)
    .innerJoin(stores, eq(storeOfferCollections.storeId, stores.id))
    .leftJoin(offerCampaigns, eq(storeOfferCollections.campaignId, offerCampaigns.id))
    .where(and(
      eq(storeOfferCollections.id, id),
      or(
        and(eq(storeOfferCollections.publicationTarget, "homepage"), eq(storeOfferCollections.publicationState, "homepage_approved")),
        and(isNull(storeOfferCollections.publicationTarget), eq(storeOfferCollections.status, "approved"))
      ),
      or(isNull(storeOfferCollections.offerProductId), sql`${storeOfferCollections.bundleRemainingQuantity} > 0`),
      eq(stores.status, "active"),
      eq(stores.isActive, true),
      or(isNull(storeOfferCollections.startsAt), lte(storeOfferCollections.startsAt, now)),
      or(isNull(storeOfferCollections.endsAt), gte(storeOfferCollections.endsAt, now))
    ))
    .limit(1);
  if (!row) return null;
  if (!isVisibleBySchedule(row.offer.visibilitySchedule, now)) return null;
  const [offerProduct] = row.offer.offerProductId && row.offer.offerVariantId
    ? await db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        productCommerceType: products.productCommerceType,
        status: products.status,
        imageUrl: inlineMediaSql("products", products.id, "mainImageUrl", products.mainImageUrl),
        variantId: productVariants.id,
        variantTitle: productVariants.title,
        price: productVariants.price,
        stockQuantity: productVariants.stockQuantity,
        reservedQuantity: productVariants.reservedQuantity
      })
      .from(products)
      .innerJoin(productVariants, eq(productVariants.id, row.offer.offerVariantId))
      .where(and(eq(products.id, row.offer.offerProductId), eq(products.status, "active"), eq(productVariants.isActive, true)))
      .limit(1)
    : [];
  if (row.offer.offerProductId && !offerProduct) return null;

  const items = await db
    .select({
      id: storeOfferItems.id,
      title: storeOfferItems.title,
      imageUrl: inlineMediaSql("storeOfferItems", storeOfferItems.id, "imageUrl", storeOfferItems.imageUrl),
      originalPrice: storeOfferItems.originalPrice,
      offerPrice: storeOfferItems.offerPrice,
      quantity: storeOfferItems.quantity,
      productId: storeOfferItems.productId,
      variantId: storeOfferItems.variantId,
      productName: products.name,
      productSlug: products.slug,
      productImageUrl: inlineMediaSql("products", products.id, "mainImageUrl", products.mainImageUrl),
      variantStock: productVariants.stockQuantity
    })
    .from(storeOfferItems)
    .innerJoin(products, eq(storeOfferItems.productId, products.id))
    .leftJoin(productVariants, eq(storeOfferItems.variantId, productVariants.id))
    .where(eq(storeOfferItems.offerId, id))
    .orderBy(storeOfferItems.sortOrder);
  return { kind: "merchant" as const, ...row, offerProduct: offerProduct || null, items };
}

async function loadAdminOffer(slugOrId: string) {
  const now = new Date();
  const clean = slugOrId.replace(/^admin-/, "");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean);
  const identityCondition: SQL = isUuid ? or(eq(adminPromotionalOffers.slug, clean), eq(adminPromotionalOffers.id, clean))! : eq(adminPromotionalOffers.slug, clean);
  const [offer] = await db
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
      socialLinks: adminPromotionalOffers.socialLinks,
      startsAt: adminPromotionalOffers.startsAt,
      endsAt: adminPromotionalOffers.endsAt,
      visibilitySchedule: adminPromotionalOffers.visibilitySchedule,
      createdAt: adminPromotionalOffers.createdAt
    })
    .from(adminPromotionalOffers)
    .where(and(identityCondition, eq(adminPromotionalOffers.status, "active"), or(isNull(adminPromotionalOffers.startsAt), lte(adminPromotionalOffers.startsAt, now)), or(isNull(adminPromotionalOffers.endsAt), gte(adminPromotionalOffers.endsAt, now))))
    .limit(1);
  return offer && isVisibleBySchedule(offer.visibilitySchedule, now) ? { kind: "admin" as const, offer } : null;
}

export async function getCachedPublicOfferDetail(id: string) {
  if (!hasDatabase()) return null;
  return cachedJson({
    key: `public:v1:offer-detail:${encodeURIComponent(id)}`,
    tags: [PUBLIC_CACHE_TAGS.offers],
    ttlSeconds: PUBLIC_CACHE_TTL.offers,
    loader: async () => id.startsWith("admin-") ? loadAdminOffer(id) : loadMerchantOffer(id)
  });
}
