import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { isVisibleBySchedule, normalizeVisibilitySchedule, type VisibilitySchedule } from "@/lib/visibility-schedule";
import { adCampaignDeliveryCounters, adCampaigns, db, notifications, products, storeOfferCollections, stores, systemSettings, wings } from "@/lib/db";

export const homepageExposurePlacements = [
  "homepage_hero",
  "homepage_promo",
  "homepage_featured_stores",
  "homepage_trending_stores",
  "homepage_latest_stores",
  "homepage_featured_products",
  "homepage_trending_products",
  "homepage_latest_products",
  "homepage_promoted_offers",
  "homepage_today_offers",
  "homepage_weekend_offers",
  "homepage_seasonal_offers",
  "homepage_featured_wings",
  "homepage_marketplace_ads",
  "homepage_sponsored_products"
] as const;

export type HomepageExposurePlacement = (typeof homepageExposurePlacements)[number];
export type HomeExposureRankingMode = "manual" | "bid" | "clicks" | "conversion" | "fair_rotation";
export type HomeExposureCommercialModel = "duration" | "cpm" | "cpc" | "visit" | "conversion";

export type HomeExposureCampaignConfig = {
  manualPriority: number;
  rankingMode?: HomeExposureRankingMode;
  rotationWeight: number;
  impressionCap: number;
  clickCap: number;
  commercialModel: HomeExposureCommercialModel;
  paidPriority: boolean;
  targetType: "store" | "product" | "offer" | "wing" | "banner";
  targetId: string | null;
  autoStop?: { reason: "impression_cap" | "click_cap"; stoppedAt: string };
};

export type HomeExposurePlacementPolicy = {
  enabled: boolean;
  limit: number;
  rankingMode: HomeExposureRankingMode;
  maxItemsPerStore: number;
  rotationIntervalMinutes: number;
};

export type HomeExposureEngineSettings = {
  enabled: boolean;
  timezone: string;
  policies: Record<HomepageExposurePlacement, HomeExposurePlacementPolicy>;
};

export type HomeExposureCounter = {
  impressions: number;
  clicks: number;
  cleanClicks: number;
  conversions: number;
  attributedRevenue: number;
  platformRevenue: number;
};

export type HomeExposureCard = {
  campaignId: string;
  placement: HomepageExposurePlacement;
  storeId: string;
  storeName: string;
  storeSlug: string;
  title: string;
  description: string;
  imageUrl: string | null;
  linkUrl: string;
  creativeVariantId: string | null;
  bidAmount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  schedule: VisibilitySchedule;
  config: HomeExposureCampaignConfig;
  counter: HomeExposureCounter;
};

const SETTINGS_GROUP = "homepage";
const SETTINGS_KEY = "exposure_revenue_engine";
const rankingModes = new Set<HomeExposureRankingMode>(["manual", "bid", "clicks", "conversion", "fair_rotation"]);
const commercialModels = new Set<HomeExposureCommercialModel>(["duration", "cpm", "cpc", "visit", "conversion"]);

function placementDefaults(placement: HomepageExposurePlacement): HomeExposurePlacementPolicy {
  const product = placement.includes("products");
  const offer = placement.includes("offers");
  return {
    enabled: true,
    limit: placement === "homepage_hero" || placement === "homepage_promo" ? 1 : product ? 4 : offer ? 2 : 1,
    rankingMode: "fair_rotation",
    maxItemsPerStore: product || offer ? 2 : 1,
    rotationIntervalMinutes: placement === "homepage_hero" || placement === "homepage_promo" ? 120 : 60
  };
}

export const defaultHomeExposureEngineSettings: HomeExposureEngineSettings = {
  enabled: true,
  timezone: "Asia/Aden",
  policies: Object.fromEntries(homepageExposurePlacements.map((placement) => [placement, placementDefaults(placement)])) as Record<HomepageExposurePlacement, HomeExposurePlacementPolicy>
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function boundedInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

export function isHomepageExposurePlacement(value: string): value is HomepageExposurePlacement {
  return (homepageExposurePlacements as readonly string[]).includes(value);
}

export function normalizeHomeExposureCampaignConfig(value: unknown): HomeExposureCampaignConfig {
  const raw = asRecord(value);
  const rankingMode = stringValue(raw.rankingMode);
  const commercialModel = stringValue(raw.commercialModel);
  const targetType = stringValue(raw.targetType, "store");
  const autoStop = asRecord(raw.autoStop);
  return {
    manualPriority: boundedInt(raw.manualPriority, 0, -10_000, 10_000),
    rankingMode: rankingModes.has(rankingMode as HomeExposureRankingMode) ? rankingMode as HomeExposureRankingMode : undefined,
    rotationWeight: boundedNumber(raw.rotationWeight, 1, 0.1, 100),
    impressionCap: boundedInt(raw.impressionCap, 0, 0, 100_000_000),
    clickCap: boundedInt(raw.clickCap, 0, 0, 100_000_000),
    commercialModel: commercialModels.has(commercialModel as HomeExposureCommercialModel) ? commercialModel as HomeExposureCommercialModel : "duration",
    paidPriority: Boolean(raw.paidPriority),
    targetType: ["store", "product", "offer", "wing", "banner"].includes(targetType) ? targetType as HomeExposureCampaignConfig["targetType"] : "store",
    targetId: typeof raw.targetId === "string" && raw.targetId.trim() ? raw.targetId : null,
    autoStop: ["impression_cap", "click_cap"].includes(stringValue(autoStop.reason)) && typeof autoStop.stoppedAt === "string"
      ? { reason: autoStop.reason as "impression_cap" | "click_cap", stoppedAt: autoStop.stoppedAt }
      : undefined
  };
}

export function campaignHomeExposureConfig(campaign: { targetConfig: unknown }) {
  return normalizeHomeExposureCampaignConfig(asRecord(campaign.targetConfig).homeExposure);
}

export function withHomeExposureConfig(targetConfig: unknown, config: HomeExposureCampaignConfig) {
  return { ...asRecord(targetConfig), homeExposure: config };
}

export function normalizeHomeExposureEngineSettings(value: unknown): HomeExposureEngineSettings {
  const raw = asRecord(value);
  const rawPolicies = asRecord(raw.policies);
  const policies = Object.fromEntries(homepageExposurePlacements.map((placement) => {
    const fallback = placementDefaults(placement);
    const policy = asRecord(rawPolicies[placement]);
    const rankingMode = stringValue(policy.rankingMode);
    return [placement, {
      enabled: policy.enabled === undefined ? fallback.enabled : Boolean(policy.enabled),
      limit: boundedInt(policy.limit, fallback.limit, 1, 12),
      rankingMode: rankingModes.has(rankingMode as HomeExposureRankingMode) ? rankingMode as HomeExposureRankingMode : fallback.rankingMode,
      maxItemsPerStore: boundedInt(policy.maxItemsPerStore, fallback.maxItemsPerStore, 1, 6),
      rotationIntervalMinutes: boundedInt(policy.rotationIntervalMinutes, fallback.rotationIntervalMinutes, 5, 1_440)
    }];
  })) as Record<HomepageExposurePlacement, HomeExposurePlacementPolicy>;
  return { enabled: raw.enabled === undefined ? true : Boolean(raw.enabled), timezone: stringValue(raw.timezone, "Asia/Aden"), policies };
}

export async function getHomeExposureEngineSettings() {
  const [setting] = await db.select({ value: systemSettings.value }).from(systemSettings).where(and(eq(systemSettings.group, SETTINGS_GROUP), eq(systemSettings.key, SETTINGS_KEY))).limit(1);
  return normalizeHomeExposureEngineSettings(setting?.value);
}

export function homeExposureTimeBucket(now: Date, minutes: number) {
  return Math.floor(now.getTime() / Math.max(5, minutes) / 60_000);
}

function hashNumber(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function exposureScore(input: { card: HomeExposureCard; policy: HomeExposurePlacementPolicy; now: Date }) {
  const { card, policy, now } = input;
  const config = card.config;
  const counter = card.counter;
  const bid = Number(card.bidAmount || 0);
  const priority = config.manualPriority * 100_000 + (config.paidPriority ? 10_000 : 0);
  const bucket = homeExposureTimeBucket(now, policy.rotationIntervalMinutes);
  const jitter = hashNumber(`${card.campaignId}:${bucket}`) * 1_000;
  const conversionRate = counter.cleanClicks > 0 ? counter.conversions / counter.cleanClicks : 0;
  const fair = (config.rotationWeight * 100_000) / Math.max(1, counter.impressions + 1) + jitter;
  const mode = config.rankingMode || policy.rankingMode;
  if (mode === "manual") return priority + jitter;
  if (mode === "bid") return priority + bid * 100 + jitter;
  if (mode === "clicks") return priority + counter.cleanClicks * 10 + jitter;
  if (mode === "conversion") return priority + conversionRate * 100_000 + counter.conversions * 100 + jitter;
  return priority + fair;
}

export function exposureCapReason(config: HomeExposureCampaignConfig, counter: HomeExposureCounter): "impression_cap" | "click_cap" | null {
  if (config.impressionCap > 0 && counter.impressions >= config.impressionCap) return "impression_cap";
  if (config.clickCap > 0 && counter.cleanClicks >= config.clickCap) return "click_cap";
  return null;
}

function numericCounter(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function toCounter(row?: typeof adCampaignDeliveryCounters.$inferSelect): HomeExposureCounter {
  return {
    impressions: Number(row?.impressions || 0),
    clicks: Number(row?.clicks || 0),
    cleanClicks: Number(row?.cleanClicks || 0),
    conversions: Number(row?.conversions || 0),
    attributedRevenue: numericCounter(row?.attributedRevenue),
    platformRevenue: numericCounter(row?.platformRevenue)
  };
}

export async function getHomepageExposureSlots(now = new Date()): Promise<Partial<Record<HomepageExposurePlacement, HomeExposureCard[]>>> {
  const settings = await getHomeExposureEngineSettings();
  if (!settings.enabled) return {};
  const rows = await db
    .select({ campaign: adCampaigns, store: stores })
    .from(adCampaigns)
    .innerJoin(stores, eq(adCampaigns.storeId, stores.id))
    .where(and(
      eq(adCampaigns.type, "homepage_exposure"),
      inArray(adCampaigns.status, ["approved", "active"]),
      inArray(adCampaigns.placementId, homepageExposurePlacements),
      eq(stores.status, "active"),
      eq(stores.isActive, true),
      or(isNull(adCampaigns.startsAt), lte(adCampaigns.startsAt, now)),
      or(isNull(adCampaigns.endsAt), gte(adCampaigns.endsAt, now))
    ))
    .orderBy(desc(adCampaigns.approvedAt), desc(adCampaigns.createdAt))
    .limit(300);
  if (!rows.length) return {};

  const counters = await db.select().from(adCampaignDeliveryCounters).where(inArray(adCampaignDeliveryCounters.campaignId, rows.map((row) => row.campaign.id)));
  const countersByCampaign = new Map(counters.map((counter) => [counter.campaignId, toCounter(counter)]));
  const targetConfigs = rows.map((row) => campaignHomeExposureConfig(row.campaign));
  const productTargetIds = targetConfigs.filter((config) => config.targetType === "product" && config.targetId).map((config) => config.targetId!);
  const offerTargetIds = targetConfigs.filter((config) => config.targetType === "offer" && config.targetId).map((config) => config.targetId!);
  const wingTargetIds = targetConfigs.filter((config) => config.targetType === "wing" && config.targetId).map((config) => config.targetId!);
  const [productTargets, offerTargets, wingTargets] = await Promise.all([
    productTargetIds.length ? db.select({ id: products.id, storeId: products.storeId, slug: products.slug }).from(products).where(inArray(products.id, productTargetIds)) : Promise.resolve([]),
    offerTargetIds.length ? db.select({ id: storeOfferCollections.id, storeId: storeOfferCollections.storeId }).from(storeOfferCollections).where(inArray(storeOfferCollections.id, offerTargetIds)) : Promise.resolve([]),
    wingTargetIds.length ? db.select({ id: wings.id, slug: wings.slug }).from(wings).where(inArray(wings.id, wingTargetIds)) : Promise.resolve([])
  ]);
  const productTargetsById = new Map(productTargets.map((target) => [target.id, target]));
  const offerTargetsById = new Map(offerTargets.map((target) => [target.id, target]));
  const wingTargetsById = new Map(wingTargets.map((target) => [target.id, target]));
  const byPlacement = new Map<HomepageExposurePlacement, HomeExposureCard[]>();

  for (const { campaign, store } of rows) {
    if (!isHomepageExposurePlacement(campaign.placementId)) continue;
    const policy = settings.policies[campaign.placementId];
    if (!policy?.enabled) continue;
    const config = campaignHomeExposureConfig(campaign);
    const counter = countersByCampaign.get(campaign.id) || toCounter();
    if (exposureCapReason(config, counter)) continue;
    const schedule = normalizeVisibilitySchedule(campaign.visibilitySchedule);
    if (!isVisibleBySchedule(schedule, now)) continue;
    const creative = asRecord(campaign.creative);
    const productTarget = config.targetType === "product" && config.targetId ? productTargetsById.get(config.targetId) : null;
    const offerTarget = config.targetType === "offer" && config.targetId ? offerTargetsById.get(config.targetId) : null;
    const wingTarget = config.targetType === "wing" && config.targetId ? wingTargetsById.get(config.targetId) : null;
    const targetLink = productTarget && productTarget.storeId === store.id
      ? `/store/${store.slug}/products/${productTarget.slug}`
      : offerTarget && offerTarget.storeId === store.id
        ? `/offers?offer=${offerTarget.id}`
        : wingTarget
          ? `/wings/${wingTarget.slug}`
          : `/store/${store.slug}`;
    const card: HomeExposureCard = {
      campaignId: campaign.id,
      placement: campaign.placementId,
      storeId: store.id,
      storeName: store.name,
      storeSlug: store.slug,
      title: stringValue(creative.headline, campaign.name),
      description: stringValue(creative.description, `إعلان ممول من ${store.name}`),
      imageUrl: typeof creative.imageUrl === "string" && creative.imageUrl.trim() ? creative.imageUrl : store.coverImageUrl || store.logoUrl || null,
      linkUrl: stringValue(creative.linkUrl, targetLink),
      creativeVariantId: typeof creative.variantId === "string" ? creative.variantId : null,
      bidAmount: numericCounter(campaign.bidAmount),
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      schedule,
      config,
      counter
    };
    byPlacement.set(card.placement, [...(byPlacement.get(card.placement) || []), card]);
  }

  const selected: Partial<Record<HomepageExposurePlacement, HomeExposureCard[]>> = {};
  for (const placement of homepageExposurePlacements) {
    const policy = settings.policies[placement];
    const candidates = byPlacement.get(placement) || [];
    if (!policy?.enabled || !candidates.length) continue;
    const perStore = new Map<string, number>();
    selected[placement] = candidates
      .sort((left, right) => exposureScore({ card: right, policy, now }) - exposureScore({ card: left, policy, now }) || left.campaignId.localeCompare(right.campaignId))
      .filter((card) => {
        const count = perStore.get(card.storeId) || 0;
        if (count >= policy.maxItemsPerStore) return false;
        perStore.set(card.storeId, count + 1);
        return true;
      })
      .slice(0, policy.limit);
  }
  return selected;
}

export async function getHomeExposureAdminSnapshot(limit = 200) {
  const [settings, rows] = await Promise.all([
    getHomeExposureEngineSettings(),
    db.select({ campaign: adCampaigns, storeName: stores.name, storeSlug: stores.slug, counter: adCampaignDeliveryCounters })
      .from(adCampaigns)
      .innerJoin(stores, eq(adCampaigns.storeId, stores.id))
      .leftJoin(adCampaignDeliveryCounters, eq(adCampaignDeliveryCounters.campaignId, adCampaigns.id))
      .where(eq(adCampaigns.type, "homepage_exposure"))
      .orderBy(desc(adCampaigns.updatedAt))
      .limit(Math.max(1, Math.min(limit, 500)))
  ]);
  return {
    settings,
    campaigns: rows.map((row) => ({
      campaign: row.campaign,
      storeName: row.storeName,
      storeSlug: row.storeSlug,
      config: campaignHomeExposureConfig(row.campaign),
      schedule: normalizeVisibilitySchedule(row.campaign.visibilitySchedule),
      counter: toCounter(row.counter || undefined),
      capReason: exposureCapReason(campaignHomeExposureConfig(row.campaign), toCounter(row.counter || undefined))
    }))
  };
}

export function isManagedHomeExposureCampaign(campaign: { type: string; placementId: string }) {
  return campaign.type === "homepage_exposure" && isHomepageExposurePlacement(campaign.placementId);
}

/** Called under the campaign delivery lock. It stops stale-page delivery after a cap or schedule ends. */
async function pauseHomeExposureForCap(input: { tx: any; campaign: typeof adCampaigns.$inferSelect; reason: "impression_cap" | "click_cap"; now: Date }) {
  const config = campaignHomeExposureConfig(input.campaign);
  const [campaign] = await input.tx.update(adCampaigns).set({
    status: "paused",
    adminNote: [input.campaign.adminNote, `[home-exposure:auto] ${input.reason}`].filter(Boolean).join("\n"),
    targetConfig: withHomeExposureConfig(input.campaign.targetConfig, { ...config, autoStop: { reason: input.reason, stoppedAt: input.now.toISOString() } }),
    updatedAt: input.now
  }).where(and(eq(adCampaigns.id, input.campaign.id), eq(adCampaigns.status, input.campaign.status))).returning();
  return campaign || null;
}

export async function enforceHomeExposureDeliveryGate(input: { tx: any; campaign: typeof adCampaigns.$inferSelect; now?: Date }) {
  if (!isManagedHomeExposureCampaign(input.campaign)) return { allowed: true as const, autoPausedCampaign: null };
  const now = input.now || new Date();
  if (!isVisibleBySchedule(input.campaign.visibilitySchedule, now)) return { allowed: false as const, reason: "outside_schedule", autoPausedCampaign: null };
  await input.tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`home-exposure:${input.campaign.id}`}))`);
  const [counter] = await input.tx.select().from(adCampaignDeliveryCounters).where(eq(adCampaignDeliveryCounters.campaignId, input.campaign.id)).limit(1);
  const reason = exposureCapReason(campaignHomeExposureConfig(input.campaign), toCounter(counter));
  if (!reason) return { allowed: true as const, autoPausedCampaign: null };
  const campaign = await pauseHomeExposureForCap({ tx: input.tx, campaign: input.campaign, reason, now });
  return { allowed: false as const, reason, autoPausedCampaign: campaign };
}

/** The delivery-counter triggers run in the same transaction; this pauses exactly when the final permitted event is recorded. */
export async function pauseHomeExposureIfCapReached(input: { tx: any; campaign: typeof adCampaigns.$inferSelect; now?: Date }) {
  if (!isManagedHomeExposureCampaign(input.campaign)) return null;
  const now = input.now || new Date();
  const [counter] = await input.tx.select().from(adCampaignDeliveryCounters).where(eq(adCampaignDeliveryCounters.campaignId, input.campaign.id)).limit(1);
  const reason = exposureCapReason(campaignHomeExposureConfig(input.campaign), toCounter(counter));
  return reason ? pauseHomeExposureForCap({ tx: input.tx, campaign: input.campaign, reason, now }) : null;
}

export async function notifyHomeExposureAutoPause(campaign: typeof adCampaigns.$inferSelect, reason: "impression_cap" | "click_cap") {
  const [store] = await db.select({ merchantId: stores.merchantId }).from(stores).where(eq(stores.id, campaign.storeId)).limit(1);
  const label = reason === "impression_cap" ? "حد الظهور" : "حد النقرات النظيفة";
  await db.insert(notifications).values({
    userId: campaign.createdBy || store?.merchantId || null,
    storeId: campaign.storeId,
    title: "تم إيقاف ظهور الحملة تلقائياً",
    body: `تم بلوغ ${label} المحدد للحملة «${campaign.name}». يمكنك مراجعة أو تمديد الحملة من الإدارة.`,
    type: "merchant_home_exposure_cap_reached",
    data: { campaignId: campaign.id, reason, url: "/merchant/ads" }
  });
}
