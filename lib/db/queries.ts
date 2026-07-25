import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { getAdvertisingSettings } from "@/lib/advertising-settings";
import { hasConfiguredDatabaseUrl } from "@/lib/db/env";
import { defaultHomeContent, getHomeContentSettings } from "@/lib/home-content";
import { defaultWelcomePopup, getWelcomePopupSettings } from "@/lib/welcome-popup";
import { filterVisibleBySchedule } from "@/lib/visibility-schedule";
import { getSponsoredProductsForPlacement } from "@/lib/ads/marketplace";
import { getHomepageExposureSlots } from "@/lib/home-exposure";
import { isHomeLayoutManaged } from "@/lib/home-layout-management";
import { inlineMediaSql, inlineSettingsMediaUrl } from "@/lib/inline-media";
import {
  defaultHomeVisibilityRules,
  getHomeVisibilityRules,
  getHomepageFeaturedStores,
  getHomepageLatestAdditions,
  getHomepageLatestStores,
  getHomepagePromotedProducts,
  getHomepageSeasonalOffers,
  getHomepageTrendingProducts,
  getHomepageWings,
  getHomepageApprovedMerchantBanners
} from "@/lib/home-visibility";
import {
  announcements,
  banners,
  categories,
  cities,
  countries,
  db,
  defaultActivityMedia,
  governorates,
  homeSections,
  news,
  storeOfferCollections,
  offerCampaigns,
  merchantApplications,
  products,
  productVariants,
  storeEmployees,
  storeMedia,
  stores,
  users,
  wings
} from "@/lib/db";

export function hasDatabase() {
  return hasConfiguredDatabaseUrl();
}

function activeWindow() {
  const now = new Date();
  return and(or(isNull(banners.startAt), lte(banners.startAt, now)), or(isNull(banners.endAt), gte(banners.endAt, now)));
}

function activeAnnouncementWindow() {
  const now = new Date();
  return and(
    or(isNull(announcements.startAt), lte(announcements.startAt, now)),
    or(isNull(announcements.endAt), gte(announcements.endAt, now))
  );
}

function activeNewsWindow() {
  const now = new Date();
  return and(or(isNull(news.startAt), lte(news.startAt, now)), or(isNull(news.endAt), gte(news.endAt, now)));
}

const homeBannerProjection = {
  id: banners.id,
  title: banners.title,
  description: banners.description,
  imageUrl: inlineMediaSql("banners", banners.id, "imageUrl", banners.imageUrl),
  linkUrl: banners.linkUrl,
  placement: banners.placement,
  sortOrder: banners.sortOrder,
  visibilitySchedule: banners.visibilitySchedule
};

const marketplaceAnnouncementProjection = {
  id: announcements.id,
  title: announcements.title,
  summary: announcements.summary,
  body: announcements.body,
  imageUrl: inlineMediaSql("announcements", announcements.id, "imageUrl", announcements.imageUrl),
  linkUrl: announcements.linkUrl,
  isPinned: announcements.isPinned,
  isPromoted: announcements.isPromoted,
  promotionPackage: announcements.promotionPackage,
  visibilitySchedule: announcements.visibilitySchedule,
  createdAt: announcements.createdAt
};

function compactHomeContentMedia<T extends Record<string, unknown>>(value: T): T {
  return {
    ...value,
    heroBackgroundImage: inlineSettingsMediaUrl("homepage", "content", "heroBackgroundImage", value.heroBackgroundImage as string | undefined)
  };
}

function compactWelcomePopupMedia<T extends Record<string, unknown>>(value: T): T {
  return {
    ...value,
    imageUrl: inlineSettingsMediaUrl("homepage", "welcome_popup", "imageUrl", value.imageUrl as string | undefined)
  };
}

export function getHomeDataFallback() {
  return {
    homeSections: [],
    homeContent: defaultHomeContent,
    welcomePopup: defaultWelcomePopup,
    banners: [],
    marketplaceNews: [],
    marketplaceAnnouncements: [],
    promotedOffers: [],
    seasonalOffers: [],
    wings: [],
    visibilityRules: defaultHomeVisibilityRules,
    latestStores: [],
    trendingStores: [],
    trendingProducts: [],
    latestAdditions: [],
    sponsoredProducts: [],
    homeExposures: {},
    homeLayoutManaged: false
  };
}

export async function getHomeData() {
  if (!hasDatabase()) return getHomeDataFallback();

  try {
    const [adSettings, homeContent, welcomePopup, visibilityRules] = await Promise.all([getAdvertisingSettings(), getHomeContentSettings(), getWelcomePopupSettings(), getHomeVisibilityRules()]);
    const now = new Date();
    const [sections, heroBanners, tickerNews, mallAds, promotedOffers, seasonalOffers, activeWings, latestStores, trendingStores, trendingProducts, latestAdditions, merchantBannerCampaigns, sponsoredProducts, homeExposures, homeLayoutManaged] =
      await Promise.all([
        db.select().from(homeSections).where(eq(homeSections.isVisible, true)).orderBy(homeSections.sortOrder),
        db.select(homeBannerProjection).from(banners).where(and(eq(banners.status, "active"), inArray(banners.placement, ["homepage_hero", "homepage_promo", "homepage_offer", "homepage_slider"]), activeWindow())).orderBy(banners.sortOrder, desc(banners.createdAt)).limit(20),
        db.select({ id: news.id, title: news.title, linkUrl: news.linkUrl, isPinned: news.isPinned, createdAt: news.createdAt }).from(news).where(and(eq(news.level, "marketplace"), eq(news.status, "active"), eq(news.isTicker, true), activeNewsWindow())).orderBy(desc(news.isPinned), desc(news.createdAt)).limit(5),
        db.select(marketplaceAnnouncementProjection).from(announcements).where(and(eq(announcements.level, "marketplace"), eq(announcements.status, "active"), activeAnnouncementWindow())).orderBy(desc(announcements.isPinned), desc(announcements.createdAt)).limit(Math.max(Math.min(adSettings.marketplaceAnnouncementsLimit, 4) * 4, 12)),
        getHomepagePromotedProducts(visibilityRules, now),
        getHomepageSeasonalOffers(visibilityRules, now),
        getHomepageWings(visibilityRules),
        getHomepageLatestStores(12),
        getHomepageFeaturedStores(visibilityRules),
        getHomepageTrendingProducts(visibilityRules.products.showTrending ? 8 : 0),
        getHomepageLatestAdditions(visibilityRules, now),
        getHomepageApprovedMerchantBanners(now),
        getSponsoredProductsForPlacement({ placement: "homepage_sponsored_products", limit: 8, now }),
        getHomepageExposureSlots(now),
        isHomeLayoutManaged()
      ]);

    const visibleHeroBanners = filterVisibleBySchedule(heroBanners, now).slice(0, 4);
    const visibleMallAds = filterVisibleBySchedule(mallAds, now).slice(0, Math.min(adSettings.marketplaceAnnouncementsLimit, 4));
    // Merge admin-approved merchant banner campaigns into the marketplace announcements
    // stream so they appear in the same ads section, badged as a merchant-sponsored ad.
    const mergedAnnouncements = [...visibleMallAds, ...merchantBannerCampaigns];

    return {
      homeSections: sections,
      homeContent: compactHomeContentMedia(homeContent),
      welcomePopup: compactWelcomePopupMedia(welcomePopup),
      banners: visibleHeroBanners,
      marketplaceNews: tickerNews,
      marketplaceAnnouncements: mergedAnnouncements,
      promotedOffers,
      seasonalOffers,
      wings: activeWings,
      visibilityRules,
      latestStores,
      trendingStores,
      trendingProducts,
      latestAdditions,
      sponsoredProducts,
      homeExposures,
      homeLayoutManaged
    };
  } catch (error) {
    console.error("Failed to load home data", error);
    return getHomeDataFallback();
  }
}

export async function getPublicStore(slug: string, options: { preview?: boolean } = {}) {
  if (!hasDatabase()) return null;

  const [store] = await db
    .select({
      id: stores.id,
      name: stores.name,
      slug: stores.slug,
      description: stores.description,
      status: stores.status,
      isActive: stores.isActive,
      storeCommerceType: stores.storeCommerceType,
      operationStatus: stores.operationStatus,
      operationNote: stores.operationNote,
      businessHours: stores.businessHours,
      coverImageUrl: inlineMediaSql("stores", stores.id, "coverImageUrl", stores.coverImageUrl),
      logoUrl: inlineMediaSql("stores", stores.id, "logoUrl", stores.logoUrl),
      introImageUrl: inlineMediaSql("stores", stores.id, "introImageUrl", stores.introImageUrl),
      videoUrl: stores.videoUrl,
      ratingAverage: stores.ratingAverage,
      ratingCount: stores.ratingCount,
      orderCount: stores.orderCount,
      contactPhone: stores.contactPhone,
      contactEmail: stores.contactEmail,
      socialLinks: stores.socialLinks,
      countryName: countries.name,
      governorateName: governorates.name,
      cityName: cities.name,
      wingId: stores.primaryWingId
    })
    .from(stores)
    .leftJoin(countries, eq(stores.countryId, countries.id))
    .leftJoin(governorates, eq(stores.governorateId, governorates.id))
    .leftJoin(cities, eq(stores.cityId, cities.id))
    .where(options.preview ? eq(stores.slug, slug) : and(eq(stores.slug, slug), eq(stores.status, "active"), eq(stores.isActive, true)))
    .limit(1);

  if (!store) return null;

  const adSettings = await getAdvertisingSettings();
  const [gallery, storeAnnouncements, storeNews, storeCategories, storeProducts, defaultMedia] = await Promise.all([
    db
      .select({
        id: storeMedia.id,
        storeId: storeMedia.storeId,
        mediaType: storeMedia.mediaType,
        url: inlineMediaSql("storeMedia", storeMedia.id, "url", storeMedia.url),
        alt: storeMedia.alt,
        sortOrder: storeMedia.sortOrder,
        isActive: storeMedia.isActive,
        createdAt: storeMedia.createdAt
      })
      .from(storeMedia)
      .where(and(eq(storeMedia.storeId, store.id), eq(storeMedia.isActive, true)))
      .orderBy(storeMedia.sortOrder)
      .limit(24),
    db
      .select({
        id: announcements.id,
        title: announcements.title,
        summary: announcements.summary,
        body: announcements.body,
        imageUrl: inlineMediaSql("announcements", announcements.id, "imageUrl", announcements.imageUrl),
        linkUrl: announcements.linkUrl,
        isPinned: announcements.isPinned,
        createdAt: announcements.createdAt,
        endAt: announcements.endAt,
        isPromoted: announcements.isPromoted,
        promotionPackage: announcements.promotionPackage
      })
      .from(announcements)
      .where(and(eq(announcements.level, "store"), eq(announcements.storeId, store.id), eq(announcements.status, "active"), activeAnnouncementWindow()))
      .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
      .limit(adSettings.storeAnnouncementsLimit),
    db
      .select()
      .from(news)
      .where(and(eq(news.level, "store"), eq(news.storeId, store.id), eq(news.status, "active"), activeNewsWindow()))
      .orderBy(desc(news.isPinned), desc(news.createdAt))
      .limit(adSettings.storeNewsLimit),
    db
      .select({
        id: categories.id,
        storeId: categories.storeId,
        parentId: categories.parentId,
        code: categories.code,
        codeMode: categories.codeMode,
        level: categories.level,
        name: categories.name,
        slug: categories.slug,
        imageUrl: inlineMediaSql("categories", categories.id, "imageUrl", categories.imageUrl),
        isActive: categories.isActive,
        sortOrder: categories.sortOrder,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt
      })
      .from(categories)
      .where(options.preview ? eq(categories.storeId, store.id) : and(eq(categories.storeId, store.id), eq(categories.isActive, true)))
      .orderBy(categories.sortOrder, categories.name),
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        categoryId: products.categoryId,
        mainImageUrl: inlineMediaSql("products", products.id, "mainImageUrl", products.mainImageUrl),
        basePrice: products.basePrice,
        status: products.status,
        productCommerceType: products.productCommerceType,
        showcaseStatus: products.showcaseStatus,
        showcaseSoldAt: products.showcaseSoldAt,
        showcaseNote: products.showcaseNote,
        ratingAverage: products.ratingAverage,
        soldCount: products.soldCount,
        viewCount: products.viewCount,
        defaultVariantId: sql<string | null>`(
          select pv.id::text
          from product_variants as pv
          where pv.product_id = ${products.id} and pv.is_active = true
          order by pv.created_at asc
          limit 1
        )`,
        defaultVariantStock: sql<number>`coalesce((
          select pv.stock_quantity
          from product_variants as pv
          where pv.product_id = ${products.id} and pv.is_active = true
          order by pv.created_at asc
          limit 1
        ), 0)::int`
      })
      .from(products)
      .where(options.preview ? eq(products.storeId, store.id) : and(eq(products.storeId, store.id), eq(products.status, "active"), sql`${products.showcaseStatus} <> 'HIDDEN'`, or(isNull(products.publishAt), lte(products.publishAt, new Date())), or(isNull(products.unpublishAt), gte(products.unpublishAt, new Date()))))
      .orderBy(desc(products.createdAt))
      .limit(80),
    store.wingId
      ? db
          .select({
            id: defaultActivityMedia.id,
            wingId: defaultActivityMedia.wingId,
            mediaType: defaultActivityMedia.mediaType,
            url: inlineMediaSql("defaultActivityMedia", defaultActivityMedia.id, "url", defaultActivityMedia.url),
            alt: defaultActivityMedia.alt,
            sortOrder: defaultActivityMedia.sortOrder,
            isActive: defaultActivityMedia.isActive,
            createdAt: defaultActivityMedia.createdAt
          })
          .from(defaultActivityMedia)
          .where(and(eq(defaultActivityMedia.wingId, store.wingId), eq(defaultActivityMedia.isActive, true)))
          .orderBy(defaultActivityMedia.sortOrder)
      : Promise.resolve([])
  ]);

  return { store, gallery, announcements: storeAnnouncements, news: storeNews, categories: storeCategories, products: storeProducts, defaultMedia };
}

export async function getAdminDashboardStats() {
  if (!hasDatabase()) {
    return { storesCount: 0, usersCount: 0, productsCount: 0, pendingApplicationsCount: 0 };
  }

  const [storesCount, usersCount, productsCount, pendingApplicationsCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(stores),
    db.select({ count: sql<number>`count(*)::int` }).from(users),
    db.select({ count: sql<number>`count(*)::int` }).from(products),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(merchantApplications)
      .where(sql`${merchantApplications.status} in ('new', 'under_review', 'waiting_for_data', 'waiting_final_approval')`)
  ]);

  return {
    storesCount: Number(storesCount[0]?.count || 0),
    usersCount: Number(usersCount[0]?.count || 0),
    productsCount: Number(productsCount[0]?.count || 0),
    pendingApplicationsCount: Number(pendingApplicationsCount[0]?.count || 0)
  };
}

export async function getMerchantPrimaryStore(userId: string) {
  if (!hasDatabase()) return null;
  const selectedStoreId = await getSelectedMerchantStoreId();

  if (selectedStoreId) {
    const [ownedSelected] = await db.select().from(stores).where(and(eq(stores.id, selectedStoreId), eq(stores.merchantId, userId))).limit(1);
    if (ownedSelected) return ownedSelected;

    const [employeeSelected] = await db
      .select({ store: stores })
      .from(storeEmployees)
      .innerJoin(stores, eq(storeEmployees.storeId, stores.id))
      .where(and(eq(stores.id, selectedStoreId), eq(storeEmployees.userId, userId), eq(storeEmployees.status, "active")))
      .limit(1);
    if (employeeSelected?.store) return employeeSelected.store;
  }

  const [ownedStore] = await db.select().from(stores).where(eq(stores.merchantId, userId)).orderBy(desc(stores.isActive), stores.createdAt).limit(1);
  if (ownedStore) return ownedStore;

  const [employeeStore] = await db
    .select({ store: stores })
    .from(storeEmployees)
    .innerJoin(stores, eq(storeEmployees.storeId, stores.id))
    .where(and(eq(storeEmployees.userId, userId), eq(storeEmployees.status, "active")))
    .limit(1);

  return employeeStore?.store || null;
}

async function getSelectedMerchantStoreId() {
  try {
    const mod = await import("next/headers");
    const cookieStore = await mod.cookies();
    return cookieStore.get("merchant_store_id")?.value || null;
  } catch {
    return null;
  }
}
