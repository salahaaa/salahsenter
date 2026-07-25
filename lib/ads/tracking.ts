import crypto from "node:crypto";
import { adsOperationalDayKey } from "@/lib/ads/operational-time";

export const adEventTypes = ["impression", "click"] as const;
export type AdEventType = (typeof adEventTypes)[number];

export const adPlacements = [
  "homepage_marketplace_ads",
  "homepage_sponsored_products",
  "homepage_featured_products",
  "homepage_promo",
  "homepage_hero",
  "homepage_featured_stores",
  "homepage_trending_stores",
  "homepage_latest_stores",
  "homepage_trending_products",
  "homepage_latest_products",
  "homepage_promoted_offers",
  "homepage_today_offers",
  "homepage_weekend_offers",
  "homepage_seasonal_offers",
  "homepage_featured_wings",
  "search_results",
  "category_listing",
  "storefront"
] as const;
export type AdPlacement = (typeof adPlacements)[number];

export function hashAdTrackingId(value: string | null | undefined) {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex");
}

function dayBucket(value: Date) {
  return adsOperationalDayKey(value);
}

/** Five-minute buckets let the server honour a configured frequency cap while
 * still deduplicating retries and accidental event bursts. */
function shortTimeBucket(value: Date) {
  return `${dayBucket(value)}:${String(value.getUTCHours()).padStart(2, "0")}:${String(Math.floor(value.getUTCMinutes() / 5) * 5).padStart(2, "0")}`;
}

/**
 * Produces a non-reversible deduplication key. Impression and click retries
 * are deduplicated per five-minute bucket; the server-side daily frequency
 * counter remains authoritative for the configured delivery cap.
 */
export function adEventKey(input: {
  eventType: AdEventType;
  campaignId: string;
  placement: AdPlacement;
  visitorHash: string;
  occurredAt?: Date;
}) {
  const occurredAt = input.occurredAt || new Date();
  const bucket = shortTimeBucket(occurredAt);
  const digest = crypto
    .createHash("sha256")
    .update([input.eventType, input.campaignId, input.placement, input.visitorHash, bucket].join("|"))
    .digest("hex");
  return `${input.eventType.slice(0, 3)}_${digest}`;
}

export function adImpressionFrequencyCap(configuredValue?: number | string | null) {
  const configured = Number(configuredValue ?? process.env.AD_IMPRESSION_FREQUENCY_CAP ?? 3);
  return Number.isFinite(configured) ? Math.max(1, Math.min(20, Math.floor(configured))) : 3;
}

export function isTrackableAdCampaign(input: { status: string; startsAt?: Date | null; endsAt?: Date | null }, now = new Date()) {
  return ["approved", "active"].includes(input.status) &&
    (!input.startsAt || input.startsAt.getTime() <= now.getTime()) &&
    (!input.endsAt || input.endsAt.getTime() >= now.getTime());
}

export function startOfUtcDay(value = new Date()) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
