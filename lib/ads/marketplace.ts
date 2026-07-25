import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { inlineMediaSql } from "@/lib/inline-media";
import { isVisibleBySchedule } from "@/lib/visibility-schedule";
import { evaluateAdServingEligibility } from "@/lib/ads/eligibility";
import { getCampaignDailyAdSpend } from "@/lib/ads/budget-pacing";
import { adCampaigns, db, products, productVariants, stores } from "@/lib/db";
import type { AdPlacement } from "@/lib/ads/tracking";

export const sponsoredProductPlacements = [
  "homepage_sponsored_products",
  "homepage_featured_products",
  "search_results",
  "category_listing",
  "storefront"
] as const;

export type SponsoredProductPlacement = (typeof sponsoredProductPlacements)[number];
export type SponsoredProduct = {
  id: string;
  name: string;
  slug: string;
  mainImageUrl: string | null;
  basePrice: string | null;
  ratingAverage: string;
  soldCount: number;
  storeId: string;
  storeName: string;
  storeSlug: string;
  adCampaignId: string;
  adPlacement: SponsoredProductPlacement;
  sponsoredLabel: "إعلان ممول";
  rankingSignals: { bid: number; relevance: number; quality: number; storeHealth: number; availability: number };
};

function numeric(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function targetRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function containsAny(text: string, terms: string[]) {
  const normalized = text.toLocaleLowerCase("ar");
  return terms.some((term) => normalized.includes(term.toLocaleLowerCase("ar")));
}

function relevanceScore(input: { productName: string; description: string | null; targetConfig: unknown; query?: string | null; categoryId: string | null; requestedCategoryId?: string | null }) {
  const config = targetRecord(input.targetConfig);
  const campaignKeywords = Array.isArray(config.keywords) ? config.keywords.filter((value): value is string => typeof value === "string" && Boolean(value.trim())) : [];
  const text = `${input.productName} ${input.description || ""}`;
  let score = 45;
  if (input.query?.trim()) score += containsAny(text, input.query.trim().split(/\s+/).filter(Boolean)) ? 35 : 0;
  if (campaignKeywords.length) score += containsAny(text, campaignKeywords) ? 15 : 0;
  if (input.requestedCategoryId && input.categoryId === input.requestedCategoryId) score += 20;
  return Math.min(100, score);
}

/**
 * Computes a transparent sponsored ranking score. This never changes organic
 * ranking: callers receive a separately labelled sponsored collection.
 */
export function calculateSponsoredRanking(input: {
  bid: number;
  maxBid: number;
  relevance: number;
  quality: number;
  storeHealth: number;
  availability: number;
}) {
  const bid = input.maxBid > 0 ? Math.min(100, (Math.max(0, input.bid) / input.maxBid) * 100) : 0;
  return bid * 0.34 + input.relevance * 0.22 + input.quality * 0.16 + input.storeHealth * 0.18 + input.availability * 0.10;
}

function isSponsoredProductPlacement(value: string): value is SponsoredProductPlacement {
  return (sponsoredProductPlacements as readonly string[]).includes(value);
}

/**
 * Returns a bounded set of product ads for a declared placement. Product and
 * store eligibility are checked server-side, including sellable stock; a
 * campaign is not allowed to boost a suspended store or an unavailable item.
 */
export async function getSponsoredProductsForPlacement(input: {
  placement: SponsoredProductPlacement;
  limit?: number;
  query?: string | null;
  categoryId?: string | null;
  now?: Date;
}) : Promise<SponsoredProduct[]> {
  const now = input.now || new Date();
  const limit = Math.max(1, Math.min(input.limit || 8, 24));
  const campaignRows = await db
    .select({ campaign: adCampaigns, store: stores })
    .from(adCampaigns)
    .innerJoin(stores, eq(adCampaigns.storeId, stores.id))
    .where(and(
      inArray(adCampaigns.type, ["sponsored_products", "featured_products"]),
      inArray(adCampaigns.status, ["approved", "active"]),
      eq(adCampaigns.placementId, input.placement),
      eq(stores.status, "active"),
      eq(stores.isActive, true),
      or(isNull(adCampaigns.startsAt), lte(adCampaigns.startsAt, now)),
      or(isNull(adCampaigns.endsAt), gte(adCampaigns.endsAt, now))
    ))
    .orderBy(desc(adCampaigns.bidAmount), desc(adCampaigns.approvedAt))
    .limit(Math.max(limit * 8, 40));

  const campaignRowsWithSpend = await Promise.all(campaignRows.map(async (row) => ({ row, dailySpent: await getCampaignDailyAdSpend(row.campaign.id, now) })));
  const eligibleCampaignRows = campaignRowsWithSpend
    .filter(({ row, dailySpent }) => isVisibleBySchedule(row.campaign.visibilitySchedule || {}, now) && evaluateAdServingEligibility({ campaign: row.campaign, dailySpent, now }).allowed)
    .map(({ row }) => row);
  const productIds = [...new Set(eligibleCampaignRows.flatMap((row) => row.campaign.productIds || []))];
  if (!productIds.length) return [];
  const [productRows, stockRows] = await Promise.all([
    db
      .select({
        id: products.id,
        storeId: products.storeId,
        categoryId: products.categoryId,
        name: products.name,
        slug: products.slug,
        description: products.description,
        mainImageUrl: inlineMediaSql("products", products.id, "mainImageUrl", products.mainImageUrl),
        basePrice: products.basePrice,
        ratingAverage: products.ratingAverage,
        soldCount: products.soldCount,
        ratingCount: products.ratingCount,
        showcaseStatus: products.showcaseStatus,
        productCommerceType: products.productCommerceType,
        publishAt: products.publishAt,
        unpublishAt: products.unpublishAt,
        storeName: stores.name,
        storeSlug: stores.slug,
        storeProfileCompleteness: stores.profileCompleteness,
        storeRatingAverage: stores.ratingAverage,
        storeOrderCount: stores.orderCount
      })
      .from(products)
      .innerJoin(stores, eq(products.storeId, stores.id))
      .where(and(inArray(products.id, productIds), eq(products.status, "active"), eq(stores.status, "active"), eq(stores.isActive, true))),
    db
      .select({ productId: productVariants.productId, availableUnits: sql<number>`coalesce(sum(greatest(${productVariants.stockQuantity} - ${productVariants.reservedQuantity}, 0)), 0)::int` })
      .from(productVariants)
      .where(and(inArray(productVariants.productId, productIds), eq(productVariants.isActive, true), sql`${productVariants.stockQuantity} > ${productVariants.reservedQuantity}`))
      .groupBy(productVariants.productId)
  ]);
  const availableByProduct = new Map(stockRows.map((row) => [row.productId, Number(row.availableUnits || 0)]));
  const productById = new Map(productRows.map((row) => [row.id, row]));
  const maxBid = Math.max(...eligibleCampaignRows.map((row) => numeric(row.campaign.bidAmount)), 0);
  const candidates: Array<SponsoredProduct & { score: number }> = [];

  for (const { campaign, store } of eligibleCampaignRows) {
    if (!isSponsoredProductPlacement(campaign.placementId)) continue;
    for (const productId of campaign.productIds || []) {
      const product = productById.get(productId);
      const availableUnits = availableByProduct.get(productId) || 0;
      if (!product || product.storeId !== campaign.storeId || product.showcaseStatus === "SOLD" || product.productCommerceType === "SHOWCASE_ONLY" || product.publishAt && product.publishAt > now || product.unpublishAt && product.unpublishAt < now || availableUnits <= 0) continue;
      const relevance = relevanceScore({ productName: product.name, description: product.description, targetConfig: campaign.targetConfig, query: input.query, categoryId: product.categoryId, requestedCategoryId: input.categoryId });
      const quality = Math.min(100,
        (product.mainImageUrl ? 35 : 0) +
        (product.description?.trim() ? 25 : 0) +
        Math.min(20, numeric(product.ratingAverage) * 4) +
        Math.min(20, Math.log10(Math.max(1, Number(product.ratingCount || 0))) * 10)
      );
      const storeHealth = Math.min(100,
        Math.min(45, numeric(store.profileCompleteness) * 0.45) +
        Math.min(30, numeric(store.ratingAverage) * 6) +
        Math.min(25, Math.log10(Math.max(1, Number(store.orderCount || 0))) * 10)
      );
      const availability = Math.min(100, 45 + Math.min(55, Math.log10(availableUnits + 1) * 28));
      const rankingSignals = { bid: numeric(campaign.bidAmount), relevance, quality, storeHealth, availability };
      candidates.push({
        id: product.id,
        name: product.name,
        slug: product.slug,
        mainImageUrl: product.mainImageUrl,
        basePrice: product.basePrice,
        ratingAverage: product.ratingAverage,
        soldCount: product.soldCount,
        storeId: product.storeId,
        storeName: product.storeName,
        storeSlug: product.storeSlug,
        adCampaignId: campaign.id,
        adPlacement: campaign.placementId,
        sponsoredLabel: "إعلان ممول",
        rankingSignals,
        score: calculateSponsoredRanking({ bid: rankingSignals.bid, maxBid, relevance, quality, storeHealth, availability })
      });
    }
  }

  const perStore = new Map<string, number>();
  return candidates
    .sort((left, right) => right.score - left.score || right.rankingSignals.bid - left.rankingSignals.bid || right.soldCount - left.soldCount)
    .filter((candidate) => {
      const count = perStore.get(candidate.storeId) || 0;
      if (count >= 2) return false;
      perStore.set(candidate.storeId, count + 1);
      return true;
    })
    .slice(0, limit)
    .map(({ score: _score, ...candidate }) => candidate);
}

/** Maps creation type to the only default placement allowed for old clients. */
export function defaultPlacementForCampaignType(type: string): AdPlacement | SponsoredProductPlacement {
  if (type === "homepage_banner") return "homepage_marketplace_ads";
  if (type === "category_banner") return "category_listing";
  if (type === "featured_products") return "homepage_featured_products";
  return "homepage_sponsored_products";
}

export function isPlacementAllowedForCampaignType(type: string, placement: string) {
  const allowed: Record<string, readonly string[]> = {
    // category_listing/storefront/category_banner are deliberately withheld
    // until their dedicated renderers and trackers are released.
    sponsored_products: ["homepage_sponsored_products", "search_results"],
    featured_products: ["homepage_featured_products", "homepage_sponsored_products", "search_results"],
    homepage_banner: ["homepage_marketplace_ads"],
    category_banner: []
  };
  return (allowed[type] || []).includes(placement);
}
