import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { inlineMediaSql, inlineMediaValueSql } from "@/lib/inline-media";
import { filterVisibleBySchedule } from "@/lib/visibility-schedule";
import {
  adCampaigns,
  cities,
  countries,
  db,
  governorates,
  offerCampaigns,
  products,
  storeOfferCollections,
  stores,
  storeWings,
  systemSettings,
  wings
} from "@/lib/db";

export type VisibilityMode = "automatic" | "manual" | "mixed" | "promoted";

export type VisibilityTarget = "stores" | "products" | "offers" | "sections" | "halls";
export type VisibilityContentType = "store" | "product" | "offer" | "wing";
export type AppearanceTypeRules = {
  bestSelling: boolean;
  topRated: boolean;
  newest: boolean;
  mostViewed: boolean;
  activeOffers: boolean;
  seasonal: boolean;
  promoted: boolean;
  manual: boolean;
  smartRecommendations: boolean;
};
export type PinnedContentRule = {
  id: string;
  type: VisibilityContentType;
  startsAt?: string | null;
  endsAt?: string | null;
  priority: number;
  note?: string;
  enabled: boolean;
};
export type HomeVisibilityRules = {
  sections: {
    featuredStores: boolean;
    trendingStores: boolean;
    trendingProducts: boolean;
    latestAdditions: boolean;
    promotedOffers: boolean;
    seasonalOffers: boolean;
    featuredWings: boolean;
    marketplaceAds: boolean;
    smartMallShortcuts: boolean;
  };
  stores: {
    mode: VisibilityMode;
    limit: number;
    manualIds: string[];
    manualRefs: string[];
    excludedIds: string[];
    excludedRefs: string[];
    weights: { sales: number; orders: number; rating: number; completeness: number; activity: number; promoted: number };
  };
  products: {
    mode: VisibilityMode;
    limit: number;
    manualIds: string[];
    manualRefs: string[];
    excludedIds: string[];
    excludedRefs: string[];
    onlyPromotedInHomepage: boolean;
    showTrending: boolean;
  };
  latestAdditions: {
    enabled: boolean;
    mode: "promoted_only" | "trusted_stores" | "manual" | "disabled";
    limit: number;
    manualIds: string[];
  };
  wings: {
    mode: VisibilityMode;
    /** عدد الأجنحة التي تظهر في كل دورة عرض داخل الواجهة الرئيسية. */
    limit: number;
    /** مدة بقاء مجموعة الأجنحة قبل الانتقال للمجموعة التالية بالثواني. */
    rotationIntervalSeconds: number;
    /** عدد الأيام التي يعتبر فيها الجناح جديداً ويظهر بعلامة جديد. */
    newBadgeDays: number;
    marqueeEnabled: boolean;
    manualIds: string[];
  };
  offers: {
    enabled: boolean;
    limit: number;
    promotedFirst: boolean;
    onlyApproved: boolean;
  };
  appearanceTypes: Record<VisibilityTarget, AppearanceTypeRules>;
  fairness: {
    maxProductsPerStore: number;
    maxOffersPerStore: number;
    maxStoresPerHall: number;
    newStoreBoostDays: number;
    avoidProductRepeatDays: number;
    activeStoreMinimumCompleteness: number;
  };
  rankingWeights: {
    sales: number;
    ratings: number;
    preparationSpeed: number;
    activity: number;
    dataQuality: number;
    cancellationRate: number;
    complaints: number;
    freshness: number;
    views: number;
    promoted: number;
  };
  seasonalRules: {
    ramadan: boolean;
    eid: boolean;
    backToSchool: boolean;
    winter: boolean;
    summer: boolean;
    seasonalBoost: number;
  };
  timeRules: {
    weekendOffers: boolean;
    eveningOffers: boolean;
    specialOccasions: boolean;
    eveningStartHour: number;
    eveningEndHour: number;
  };
  pinnedContent: PinnedContentRule[];
};

const defaultAppearanceTypeRules: AppearanceTypeRules = {
  bestSelling: true,
  topRated: true,
  newest: true,
  mostViewed: true,
  activeOffers: true,
  seasonal: true,
  promoted: true,
  manual: true,
  smartRecommendations: true
};

export const defaultHomeVisibilityRules: HomeVisibilityRules = {
  sections: {
    featuredStores: true,
    trendingStores: true,
    trendingProducts: true,
    latestAdditions: true,
    promotedOffers: true,
    seasonalOffers: true,
    featuredWings: true,
    marketplaceAds: true,
    smartMallShortcuts: true
  },
  stores: {
    mode: "automatic",
    limit: 6,
    manualIds: [],
    manualRefs: [],
    excludedIds: [],
    excludedRefs: [],
    weights: { sales: 30, orders: 20, rating: 20, completeness: 10, activity: 10, promoted: 10 }
  },
  products: {
    mode: "promoted",
    limit: 8,
    manualIds: [],
    manualRefs: [],
    excludedIds: [],
    excludedRefs: [],
    onlyPromotedInHomepage: true,
    showTrending: true
  },
  latestAdditions: {
    enabled: true,
    mode: "promoted_only",
    limit: 6,
    manualIds: []
  },
  wings: {
    mode: "automatic",
    limit: 10,
    rotationIntervalSeconds: 30,
    newBadgeDays: 14,
    marqueeEnabled: true,
    manualIds: []
  },
  offers: {
    enabled: true,
    limit: 9,
    promotedFirst: true,
    onlyApproved: true
  },
  appearanceTypes: {
    stores: defaultAppearanceTypeRules,
    products: defaultAppearanceTypeRules,
    offers: defaultAppearanceTypeRules,
    sections: defaultAppearanceTypeRules,
    halls: defaultAppearanceTypeRules
  },
  fairness: {
    maxProductsPerStore: 2,
    maxOffersPerStore: 2,
    maxStoresPerHall: 4,
    newStoreBoostDays: 30,
    avoidProductRepeatDays: 7,
    activeStoreMinimumCompleteness: 50
  },
  rankingWeights: {
    sales: 40,
    ratings: 25,
    preparationSpeed: 10,
    activity: 20,
    dataQuality: 15,
    cancellationRate: -10,
    complaints: -10,
    freshness: 15,
    views: 10,
    promoted: 20
  },
  seasonalRules: {
    ramadan: false,
    eid: false,
    backToSchool: false,
    winter: false,
    summer: false,
    seasonalBoost: 15
  },
  timeRules: {
    weekendOffers: true,
    eveningOffers: false,
    specialOccasions: false,
    eveningStartHour: 18,
    eveningEndHour: 23
  },
  pinnedContent: []
};

export function normalizeHomeVisibilityRules(value: unknown): HomeVisibilityRules {
  const incoming = (value || {}) as Partial<HomeVisibilityRules>;
  return {
    sections: { ...defaultHomeVisibilityRules.sections, ...(incoming.sections || {}) },
    stores: { ...defaultHomeVisibilityRules.stores, ...(incoming.stores || {}), weights: { ...defaultHomeVisibilityRules.stores.weights, ...(incoming.stores?.weights || {}) } },
    products: { ...defaultHomeVisibilityRules.products, ...(incoming.products || {}) },
    latestAdditions: { ...defaultHomeVisibilityRules.latestAdditions, ...(incoming.latestAdditions || {}) },
    wings: { ...defaultHomeVisibilityRules.wings, ...(incoming.wings || {}) },
    offers: { ...defaultHomeVisibilityRules.offers, ...(incoming.offers || {}) },
    appearanceTypes: {
      stores: { ...defaultAppearanceTypeRules, ...(incoming.appearanceTypes?.stores || {}) },
      products: { ...defaultAppearanceTypeRules, ...(incoming.appearanceTypes?.products || {}) },
      offers: { ...defaultAppearanceTypeRules, ...(incoming.appearanceTypes?.offers || {}) },
      sections: { ...defaultAppearanceTypeRules, ...(incoming.appearanceTypes?.sections || {}) },
      halls: { ...defaultAppearanceTypeRules, ...(incoming.appearanceTypes?.halls || {}) }
    },
    fairness: { ...defaultHomeVisibilityRules.fairness, ...(incoming.fairness || {}) },
    rankingWeights: { ...defaultHomeVisibilityRules.rankingWeights, ...(incoming.rankingWeights || {}) },
    seasonalRules: { ...defaultHomeVisibilityRules.seasonalRules, ...(incoming.seasonalRules || {}) },
    timeRules: { ...defaultHomeVisibilityRules.timeRules, ...(incoming.timeRules || {}) },
    pinnedContent: Array.isArray(incoming.pinnedContent) ? incoming.pinnedContent.filter((item) => item?.id && item?.type).map((item) => ({ ...item, priority: item.priority ?? 100, enabled: item.enabled ?? true })) : []
  };
}

export async function getHomeVisibilityRules(): Promise<HomeVisibilityRules> {
  try {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(and(eq(systemSettings.group, "homepage"), eq(systemSettings.key, "visibility_rules")))
      .limit(1);
    return normalizeHomeVisibilityRules(setting?.value);
  } catch {
    return defaultHomeVisibilityRules;
  }
}

const storeProjection = {
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
  primaryWingId: stores.primaryWingId,
  createdAt: stores.createdAt
};

const productProjection = {
  id: products.id,
  name: products.name,
  slug: products.slug,
  mainImageUrl: inlineMediaSql("products", products.id, "mainImageUrl", products.mainImageUrl),
  basePrice: products.basePrice,
  ratingAverage: products.ratingAverage,
  soldCount: products.soldCount,
  storeId: stores.id,
  storeName: stores.name,
  storeSlug: stores.slug
};

const wingProjection = {
  id: wings.id,
  name: wings.name,
  slug: wings.slug,
  iconUrl: inlineMediaSql("wings", wings.id, "iconUrl", wings.iconUrl),
  heroImageUrl: inlineMediaSql("wings", wings.id, "heroImageUrl", wings.heroImageUrl),
  mobileImageUrl: inlineMediaSql("wings", wings.id, "mobileImageUrl", wings.mobileImageUrl),
  desktopImageUrl: inlineMediaSql("wings", wings.id, "desktopImageUrl", wings.desktopImageUrl),
  description: wings.description,
  isActive: wings.isActive,
  sortOrder: wings.sortOrder,
  createdAt: wings.createdAt,
  updatedAt: wings.updatedAt,
  storeCount: sql<number>`(
    select count(distinct wing_store_counts.id)::int
    from stores as wing_store_counts
    left join store_wings as wing_store_links on wing_store_links.store_id = wing_store_counts.id
    where wing_store_counts.status = 'active'
      and wing_store_counts.is_active = true
      and (wing_store_counts.primary_wing_id = "wings"."id" or wing_store_links.wing_id = "wings"."id")
  )`,
  productCount: sql<number>`(
    select count(distinct wing_product_counts.id)::int
    from products as wing_product_counts
    inner join stores as wing_product_stores on wing_product_counts.store_id = wing_product_stores.id
    left join store_wings as wing_product_store_links on wing_product_store_links.store_id = wing_product_stores.id
    where wing_product_counts.status = 'active'
      and wing_product_stores.status = 'active'
      and wing_product_stores.is_active = true
      and (wing_product_stores.primary_wing_id = "wings"."id" or wing_product_store_links.wing_id = "wings"."id")
  )`,
  ratingAverage: sql<string>`coalesce((
    select avg(wing_rating_stores.rating_average)::numeric(3,2)
    from stores as wing_rating_stores
    left join store_wings as wing_rating_store_links on wing_rating_store_links.store_id = wing_rating_stores.id
    where wing_rating_stores.status = 'active'
      and wing_rating_stores.is_active = true
      and (wing_rating_stores.primary_wing_id = "wings"."id" or wing_rating_store_links.wing_id = "wings"."id")
  ), 0)::text`
};

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function isPinnedActive(item: PinnedContentRule, now = new Date()) {
  if (!item.enabled) return false;
  const start = item.startsAt ? new Date(item.startsAt) : null;
  const end = item.endsAt ? new Date(item.endsAt) : null;
  if (start && Number.isFinite(start.getTime()) && start > now) return false;
  if (end && Number.isFinite(end.getTime()) && end < now) return false;
  return true;
}

function activePinnedIds(rules: HomeVisibilityRules, type: VisibilityContentType, now = new Date()) {
  return rules.pinnedContent
    .filter((item) => item.type === type && isPinnedActive(item, now))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .map((item) => item.id);
}

function extractLastPathPart(ref: string) {
  const clean = ref.trim();
  if (!clean) return "";
  try {
    const url = new URL(clean.startsWith("http") ? clean : `https://local${clean.startsWith("/") ? clean : `/${clean}`}`);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || clean;
  } catch {
    return clean.split("/").filter(Boolean).pop() || clean;
  }
}

async function resolveStoreRefs(refs: string[]) {
  const clean = refs.map(extractLastPathPart).filter(Boolean);
  if (!clean.length) return [];
  const rows = await db.select({ id: stores.id }).from(stores).where(or(inArray(stores.id, clean), inArray(stores.slug, clean), inArray(stores.storeNumber, clean))!).limit(clean.length);
  return rows.map((row) => row.id);
}

async function resolveProductRefs(refs: string[]) {
  const clean = refs.map(extractLastPathPart).filter(Boolean);
  if (!clean.length) return [];
  const rows = await db.select({ id: products.id }).from(products).where(or(inArray(products.id, clean), inArray(products.slug, clean), inArray(products.productCode, clean))!).limit(clean.length);
  return rows.map((row) => row.id);
}

function applyStoreCap<T extends { storeId?: string | null }>(items: T[], maxPerStore: number) {
  if (!maxPerStore || maxPerStore < 1) return items;
  const counts = new Map<string, number>();
  return items.filter((item) => {
    const storeId = item.storeId || "unknown";
    const current = counts.get(storeId) || 0;
    if (current >= maxPerStore) return false;
    counts.set(storeId, current + 1);
    return true;
  });
}

function applyWingStoreCap<T extends { primaryWingId?: string | null }>(items: T[], maxPerHall: number) {
  if (!maxPerHall || maxPerHall < 1) return items;
  const counts = new Map<string, number>();
  return items.filter((item) => {
    const wingId = item.primaryWingId || "unclassified";
    const current = counts.get(wingId) || 0;
    if (current >= maxPerHall) return false;
    counts.set(wingId, current + 1);
    return true;
  });
}

function rankingScoreSql(kind: "store" | "product", rules: HomeVisibilityRules) {
  const w = rules.rankingWeights;
  if (kind === "store") {
    return sql<number>`(
      coalesce(${stores.salesTotal}, 0) * ${w.sales / 100} +
      coalesce(${stores.ratingAverage}, 0) * 20 * ${w.ratings / 100} +
      coalesce(${stores.orderCount}, 0) * ${w.activity / 100} +
      coalesce(${stores.profileCompleteness}, 0) * ${w.dataQuality / 100} +
      case when coalesce(${stores.salesTotal}, 0) > 0 or coalesce(${stores.orderCount}, 0) > 0 then ${w.promoted / 4} else 0 end +
      case when ${stores.createdAt} >= now() - (${rules.fairness.newStoreBoostDays} || ' days')::interval then ${w.freshness} else 0 end
    )`;
  }
  return sql<number>`(
    coalesce(${products.soldCount}, 0) * ${w.sales / 100} +
    coalesce(${products.ratingAverage}, 0) * 20 * ${w.ratings / 100} +
    coalesce(${products.viewCount}, 0) * ${w.views / 100} +
    case when ${products.isPromoted} then ${w.promoted} else 0 end +
    case when ${products.createdAt} >= now() - (${rules.fairness.avoidProductRepeatDays} || ' days')::interval then ${w.freshness} else 0 end
  )`;
}

export async function getHomepageFeaturedStores(rules: HomeVisibilityRules, now = new Date()) {
  const limit = rules.stores.limit;
  const resolvedManualRefs = await resolveStoreRefs(rules.stores.manualRefs || []);
  const excludedIds = new Set([...(rules.stores.excludedIds || []), ...(await resolveStoreRefs(rules.stores.excludedRefs || []))]);
  const manualIds = [...activePinnedIds(rules, "store", now), ...rules.stores.manualIds, ...resolvedManualRefs].filter((id) => id && !excludedIds.has(id));
  const manualRows = manualIds.length
    ? await db
        .select(storeProjection)
        .from(stores)
        .leftJoin(countries, eq(stores.countryId, countries.id))
        .leftJoin(governorates, eq(stores.governorateId, governorates.id))
        .leftJoin(cities, eq(stores.cityId, cities.id))
        .where(and(eq(stores.status, "active"), eq(stores.isActive, true), inArray(stores.id, manualIds)))
        .limit(Math.max(limit, manualIds.length))
    : [];
  const manual = manualIds.map((id) => manualRows.find((store) => store.id === id)).filter((store): store is (typeof manualRows)[number] => Boolean(store));

  if (rules.stores.mode === "manual") return applyWingStoreCap(uniqueById(manual), rules.fairness.maxStoresPerHall).slice(0, limit);

  const rankingScore = rankingScoreSql("store", rules);
  const automatic = await db
    .select(storeProjection)
    .from(stores)
    .leftJoin(countries, eq(stores.countryId, countries.id))
    .leftJoin(governorates, eq(stores.governorateId, governorates.id))
    .leftJoin(cities, eq(stores.cityId, cities.id))
    .where(and(eq(stores.status, "active"), eq(stores.isActive, true), gte(stores.profileCompleteness, rules.fairness.activeStoreMinimumCompleteness)))
    .orderBy(desc(rankingScore), desc(stores.salesTotal), desc(stores.orderCount), desc(stores.ratingAverage), desc(stores.profileCompleteness))
    .limit(Math.max(limit * 4, limit));

  return applyWingStoreCap(uniqueById(rules.stores.mode === "mixed" ? [...manual, ...automatic] : [...manual, ...automatic]).filter((store) => !excludedIds.has(store.id)), rules.fairness.maxStoresPerHall).slice(0, limit);
}

export async function getHomepageLatestStores(limit = 8) {
  return db
    .select(storeProjection)
    .from(stores)
    .leftJoin(countries, eq(stores.countryId, countries.id))
    .leftJoin(governorates, eq(stores.governorateId, governorates.id))
    .leftJoin(cities, eq(stores.cityId, cities.id))
    .where(and(eq(stores.status, "active"), eq(stores.isActive, true)))
    .orderBy(desc(stores.createdAt))
    .limit(limit);
}

export async function getHomepageWings(rules: HomeVisibilityRules) {
  const manualIds = rules.wings.manualIds.filter(Boolean);
  // الواجهة الرئيسية يجب أن تعرض عينة ذكية وخفيفة فقط؛ صفحة /wings تبقى لكل الأجنحة.
  const maxWingsForHomepage = Math.min(Math.max(Number(rules.wings.limit || 10) * 3, 12), 30);
  const manualRows = manualIds.length
    ? await db.select(wingProjection).from(wings).where(and(eq(wings.isActive, true), inArray(wings.id, manualIds))).limit(Math.min(manualIds.length, maxWingsForHomepage))
    : [];
  const manual = manualIds
    .map((id) => manualRows.find((wing) => wing.id === id))
    .filter((wing): wing is (typeof manualRows)[number] => Boolean(wing));

  if (rules.wings.mode === "manual") return manual;

  const automatic = await db.select(wingProjection).from(wings).where(eq(wings.isActive, true)).orderBy(wings.sortOrder, wings.name).limit(maxWingsForHomepage);
  return uniqueById(rules.wings.mode === "mixed" ? [...manual, ...automatic] : automatic);
}

export async function getHomepagePromotedProducts(rules: HomeVisibilityRules, now = new Date()) {
  if (!rules.products.showTrending && rules.products.mode !== "promoted") return [];
  const limit = rules.products.limit;
  const resolvedManualRefs = await resolveProductRefs(rules.products.manualRefs || []);
  const excludedIds = new Set([...(rules.products.excludedIds || []), ...(await resolveProductRefs(rules.products.excludedRefs || []))]);
  const manualIds = [...activePinnedIds(rules, "product", now), ...rules.products.manualIds, ...resolvedManualRefs].filter((id) => id && !excludedIds.has(id));
  const manualRows = manualIds.length
    ? await db
        .select(productProjection)
        .from(products)
        .innerJoin(stores, eq(products.storeId, stores.id))
        .where(and(eq(products.status, "active"), eq(stores.status, "active"), eq(stores.isActive, true), inArray(products.id, manualIds)))
        .limit(Math.max(limit, manualIds.length))
    : [];
  const manual = manualIds.map((id) => manualRows.find((product) => product.id === id)).filter((product): product is (typeof manualRows)[number] => Boolean(product));
  if (rules.products.mode === "manual") return applyStoreCap(uniqueById(manual).filter((product) => !excludedIds.has(product.id)), rules.fairness.maxProductsPerStore).slice(0, limit);

  const where = rules.products.onlyPromotedInHomepage || rules.products.mode === "promoted"
    ? and(eq(products.status, "active"), eq(products.isPromoted, true), eq(stores.status, "active"), eq(stores.isActive, true), or(isNull(products.promotionStart), lte(products.promotionStart, now)), or(isNull(products.promotionEnd), gte(products.promotionEnd, now)))
    : and(eq(products.status, "active"), eq(stores.status, "active"), eq(stores.isActive, true));

  const rankingScore = rankingScoreSql("product", rules);
  const automatic = await db
    .select(productProjection)
    .from(products)
    .innerJoin(stores, eq(products.storeId, stores.id))
    .where(where)
    .orderBy(desc(rankingScore), desc(products.isPromoted), desc(products.promotionStart), desc(products.soldCount), desc(products.viewCount), desc(products.ratingAverage))
    .limit(Math.max(limit * 5, limit));

  return applyStoreCap(uniqueById(rules.products.mode === "mixed" ? [...manual, ...automatic] : [...manual, ...automatic]).filter((product) => !excludedIds.has(product.id)), rules.fairness.maxProductsPerStore).slice(0, limit);
}

export async function getHomepageTrendingProducts(limit = 12) {
  return db
    .select(productProjection)
    .from(products)
    .innerJoin(stores, eq(products.storeId, stores.id))
    .where(and(eq(products.status, "active"), eq(stores.status, "active"), eq(stores.isActive, true)))
    .orderBy(desc(products.soldCount), desc(products.viewCount), desc(products.ratingAverage))
    .limit(limit);
}

export async function getHomepageLatestAdditions(rules: HomeVisibilityRules, now = new Date()) {
  if (!rules.latestAdditions.enabled || rules.latestAdditions.mode === "disabled") return [];
  const limit = rules.latestAdditions.limit;
  const manualIds = rules.latestAdditions.manualIds.filter(Boolean);

  if (rules.latestAdditions.mode === "manual" && manualIds.length) {
    return db
      .select(productProjection)
      .from(products)
      .innerJoin(stores, eq(products.storeId, stores.id))
      .where(and(eq(products.status, "active"), eq(stores.status, "active"), eq(stores.isActive, true), inArray(products.id, manualIds)))
      .limit(limit);
  }

  const where = rules.latestAdditions.mode === "promoted_only"
    ? and(eq(products.status, "active"), eq(products.isPromoted, true), eq(stores.status, "active"), eq(stores.isActive, true), or(isNull(products.promotionStart), lte(products.promotionStart, now)), or(isNull(products.promotionEnd), gte(products.promotionEnd, now)))
    : and(eq(products.status, "active"), eq(stores.status, "active"), eq(stores.isActive, true), gte(stores.profileCompleteness, 60));

  return db
    .select(productProjection)
    .from(products)
    .innerJoin(stores, eq(products.storeId, stores.id))
    .where(where)
    .orderBy(desc(products.isPromoted), desc(products.createdAt))
    .limit(limit);
}

export async function getHomepageSeasonalOffers(rules: HomeVisibilityRules, now = new Date()) {
  if (!rules.offers.enabled) return [];
  const pinnedIds = activePinnedIds(rules, "offer", now);
  const pinnedRows = pinnedIds.length
    ? await db
        .select({
          id: storeOfferCollections.id,
          title: storeOfferCollections.title,
          description: storeOfferCollections.description,
          imageUrl: inlineMediaSql("storeOfferCollections", storeOfferCollections.id, "imageUrl", storeOfferCollections.imageUrl),
          status: storeOfferCollections.status,
          isPromoted: storeOfferCollections.isPromoted,
          campaignName: offerCampaigns.name,
          campaignSlug: offerCampaigns.slug,
          storeId: stores.id,
          storeName: stores.name,
          storeSlug: stores.slug,
          startsAt: storeOfferCollections.startsAt,
          endsAt: storeOfferCollections.endsAt,
          visibilitySchedule: storeOfferCollections.visibilitySchedule
        })
        .from(storeOfferCollections)
        .innerJoin(stores, eq(storeOfferCollections.storeId, stores.id))
        .leftJoin(offerCampaigns, eq(storeOfferCollections.campaignId, offerCampaigns.id))
        .where(and(
          eq(stores.status, "active"),
          eq(stores.isActive, true),
          or(
            and(eq(storeOfferCollections.publicationTarget, "homepage"), eq(storeOfferCollections.publicationState, "homepage_approved")),
            and(isNull(storeOfferCollections.publicationTarget), eq(storeOfferCollections.status, "approved"))
          ),
          or(isNull(storeOfferCollections.offerProductId), sql`${storeOfferCollections.bundleRemainingQuantity} > 0`),
          inArray(storeOfferCollections.id, pinnedIds)
        ))
        .limit(pinnedIds.length)
    : [];
  const orderedPinned = pinnedIds.map((id) => pinnedRows.find((row) => row.id === id)).filter((row): row is (typeof pinnedRows)[number] => Boolean(row));
  const rows = await db
    .select({
      id: storeOfferCollections.id,
      title: storeOfferCollections.title,
      description: storeOfferCollections.description,
      imageUrl: inlineMediaSql("storeOfferCollections", storeOfferCollections.id, "imageUrl", storeOfferCollections.imageUrl),
      status: storeOfferCollections.status,
      isPromoted: storeOfferCollections.isPromoted,
      campaignName: offerCampaigns.name,
      campaignSlug: offerCampaigns.slug,
      storeId: stores.id,
      storeName: stores.name,
      storeSlug: stores.slug,
      startsAt: storeOfferCollections.startsAt,
      endsAt: storeOfferCollections.endsAt,
      visibilitySchedule: storeOfferCollections.visibilitySchedule
    })
    .from(storeOfferCollections)
    .innerJoin(stores, eq(storeOfferCollections.storeId, stores.id))
    .leftJoin(offerCampaigns, eq(storeOfferCollections.campaignId, offerCampaigns.id))
    .where(and(
      rules.offers.onlyApproved
        ? or(
            and(eq(storeOfferCollections.publicationTarget, "homepage"), eq(storeOfferCollections.publicationState, "homepage_approved")),
            and(isNull(storeOfferCollections.publicationTarget), eq(storeOfferCollections.status, "approved"))
          )
        : eq(storeOfferCollections.publicationTarget, "homepage"),
      or(isNull(storeOfferCollections.offerProductId), sql`${storeOfferCollections.bundleRemainingQuantity} > 0`),
      eq(stores.status, "active"),
      eq(stores.isActive, true),
      or(isNull(storeOfferCollections.startsAt), lte(storeOfferCollections.startsAt, now)),
      or(isNull(storeOfferCollections.endsAt), gte(storeOfferCollections.endsAt, now)),
      or(isNull(offerCampaigns.id), and(eq(offerCampaigns.status, "active"), eq(offerCampaigns.isHomepageVisible, true)))
    ))
    .orderBy(rules.offers.promotedFirst ? desc(storeOfferCollections.isPromoted) : desc(storeOfferCollections.createdAt), desc(storeOfferCollections.createdAt))
    .limit(rules.offers.limit * 5);
  return applyStoreCap(filterVisibleBySchedule(uniqueById([...orderedPinned, ...rows]), now), rules.fairness.maxOffersPerStore).slice(0, rules.offers.limit);
}

/**
 * Approved merchant banner campaigns destined for the homepage.
 * These are submitted by merchants as `homepage_banner` campaigns, reviewed and
 * approved by the admin (status 'approved' or 'active'), and within their run window.
 * Returned rows are shaped to merge seamlessly with marketplace announcements,
 * carrying a `storeName` + `isMerchantAd` marker so the UI can badge them.
 *
 * NOTE: the creative image (creative->>imageUrl) is inlined to a proxy URL via
 * a SQL case expression so base64 never bloats the SSR payload.
 */
export async function getHomepageApprovedMerchantBanners(now = new Date()) {
  const rows = await db
    .select({
      id: adCampaigns.id,
      name: adCampaigns.name,
      headline: sql<string | null>`${adCampaigns.creative}->>'headline'`,
      description: sql<string | null>`${adCampaigns.creative}->>'description'`,
      imageUrl: inlineMediaValueSql("adCampaigns", adCampaigns.id, "creativeImageUrl", sql<string | null>`${adCampaigns.creative}->>'imageUrl'`),
      linkUrl: sql<string | null>`${adCampaigns.creative}->>'linkUrl'`,
      visibilitySchedule: adCampaigns.visibilitySchedule,
      creative: adCampaigns.creative,
      approvedAt: adCampaigns.approvedAt,
      createdAt: adCampaigns.createdAt,
      storeName: stores.name,
      storeSlug: stores.slug
    })
    .from(adCampaigns)
    .innerJoin(stores, eq(adCampaigns.storeId, stores.id))
    .where(and(
      eq(adCampaigns.type, "homepage_banner"),
      inArray(adCampaigns.status, ["approved", "active"]),
      eq(stores.status, "active"),
      eq(stores.isActive, true),
      or(isNull(adCampaigns.startsAt), lte(adCampaigns.startsAt, now)),
      or(isNull(adCampaigns.endsAt), gte(adCampaigns.endsAt, now))
    ))
    .orderBy(desc(adCampaigns.approvedAt), desc(adCampaigns.createdAt))
    .limit(20);

  return filterVisibleBySchedule(rows, now).slice(0, 4).map((row) => {
    const creative = row.creative && typeof row.creative === "object" && !Array.isArray(row.creative) ? row.creative as Record<string, unknown> : {};
    const variants = Array.isArray(creative.variants)
      ? creative.variants
        .filter((variant): variant is Record<string, unknown> => Boolean(variant) && typeof variant === "object" && !Array.isArray(variant) && typeof variant.id === "string")
        .slice(0, 3)
        .map((variant) => ({ id: variant.id as string, label: typeof variant.label === "string" ? variant.label : "A", title: typeof variant.headline === "string" ? variant.headline : row.headline || row.name, summary: typeof variant.description === "string" ? variant.description : row.description || "", imageUrl: row.imageUrl, linkUrl: row.linkUrl || `/store/${row.storeSlug}` }))
      : [];
    return {
      id: `merchant-ad:${row.id}`,
      adCampaignId: row.id,
      adPlacement: "homepage_marketplace_ads",
      title: row.headline || row.name,
      summary: row.description || "",
      body: "",
      imageUrl: row.imageUrl,
      linkUrl: row.linkUrl || `/store/${row.storeSlug}`,
      creativeVariants: variants,
      isPinned: false,
      isPromoted: true,
      isMerchantAd: true,
      storeName: row.storeName,
      storeSlug: row.storeSlug,
      createdAt: row.approvedAt || row.createdAt
    };
  });
}
