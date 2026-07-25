"use client";

export const AD_LAST_CLICK_STORAGE_KEY = "salah_center_ad_last_click";
const ATTRIBUTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PendingAdAttribution = {
  campaignId: string;
  placement: "homepage_marketplace_ads" | "homepage_sponsored_products" | "homepage_featured_products" | "homepage_promo" | "homepage_hero" | "homepage_featured_stores" | "homepage_trending_stores" | "homepage_latest_stores" | "homepage_trending_products" | "homepage_latest_products" | "homepage_promoted_offers" | "homepage_today_offers" | "homepage_weekend_offers" | "homepage_seasonal_offers" | "homepage_featured_wings" | "search_results" | "category_listing" | "storefront";
  productId: string | null;
  attributionToken: string;
  clickedAt: string;
};

function browserStorage() {
  try { return window.sessionStorage; } catch { return null; }
}

export function savePendingAdAttribution(input: PendingAdAttribution) {
  browserStorage()?.setItem(AD_LAST_CLICK_STORAGE_KEY, JSON.stringify(input));
}

/** Returns only a well-formed, recent attribution record; the server remains authoritative. */
export function readPendingAdAttribution(): PendingAdAttribution | null {
  try {
    const raw = browserStorage()?.getItem(AD_LAST_CLICK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingAdAttribution>;
    const clickedAt = typeof parsed.clickedAt === "string" ? new Date(parsed.clickedAt) : null;
    if (!parsed.campaignId || !uuidPattern.test(parsed.campaignId) || !parsed.attributionToken || !uuidPattern.test(parsed.attributionToken) || !clickedAt || Number.isNaN(clickedAt.getTime()) || Date.now() - clickedAt.getTime() > ATTRIBUTION_WINDOW_MS || clickedAt.getTime() > Date.now() + 5 * 60 * 1000) {
      browserStorage()?.removeItem(AD_LAST_CLICK_STORAGE_KEY);
      return null;
    }
    return {
      campaignId: parsed.campaignId,
      placement: parsed.placement as PendingAdAttribution["placement"],
      productId: typeof parsed.productId === "string" ? parsed.productId : null,
      attributionToken: parsed.attributionToken,
      clickedAt: clickedAt.toISOString()
    };
  } catch {
    return null;
  }
}

export function clearPendingAdAttribution() {
  browserStorage()?.removeItem(AD_LAST_CLICK_STORAGE_KEY);
}
