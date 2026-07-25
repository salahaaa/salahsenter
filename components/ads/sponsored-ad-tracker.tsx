"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { savePendingAdAttribution } from "@/lib/ads/client-attribution";

const VISITOR_KEY = "salah_center_ad_visitor";
const IMPRESSION_PREFIX = "salah_center_ad_impression";

type Placement = "homepage_marketplace_ads" | "homepage_sponsored_products" | "homepage_featured_products" | "homepage_promo" | "homepage_hero" | "homepage_featured_stores" | "homepage_trending_stores" | "homepage_latest_stores" | "homepage_trending_products" | "homepage_latest_products" | "homepage_promoted_offers" | "homepage_today_offers" | "homepage_weekend_offers" | "homepage_seasonal_offers" | "homepage_featured_wings" | "search_results" | "category_listing" | "storefront";

function storage() {
  try { return window.localStorage; } catch { return null; }
}

function visitorId() {
  const currentStorage = storage();
  let id = currentStorage?.getItem(VISITOR_KEY) || null;
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `ad_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    currentStorage?.setItem(VISITOR_KEY, id);
  }
  return id;
}

function impressionBucket() {
  const now = new Date();
  return `${now.toISOString().slice(0, 10)}:${now.getUTCHours()}:${Math.floor(now.getUTCMinutes() / 5)}`;
}

function sendEvent(input: { eventType: "impression" | "click"; campaignId: string; placement: Placement; productId?: string | null; attributionToken?: string | null; creativeVariantId?: string | null; viewableMs?: number; viewportRatio?: number }) {
  void fetch("/api/ads/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, visitorId: visitorId() }),
    keepalive: true
  }).catch(() => undefined);
}

/**
 * Tracks a clearly labelled sponsored placement only after it becomes visible.
 * The server also deduplicates and applies the campaign frequency cap, so local
 * browser storage is merely a traffic-saving optimization.
 */
export function SponsoredAdTracker({ campaignId, placement, productId, creativeVariantId, children }: { campaignId: string; placement: Placement; productId?: string | null; creativeVariantId?: string | null; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const seenKey = `${IMPRESSION_PREFIX}:${campaignId}:${placement}:${impressionBucket()}`;
    let qualifyingTimer: number | null = null;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.find((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5);
      if (!visible) {
        if (qualifyingTimer) window.clearTimeout(qualifyingTimer);
        qualifyingTimer = null;
        return;
      }
      if (qualifyingTimer) return;
      const ratio = visible.intersectionRatio;
      qualifyingTimer = window.setTimeout(() => {
        try {
          if (window.sessionStorage.getItem(seenKey)) return;
          window.sessionStorage.setItem(seenKey, "1");
        } catch {
          // Server-side event keys remain authoritative if browser storage is unavailable.
        }
        sendEvent({ eventType: "impression", campaignId, placement, productId, creativeVariantId, viewableMs: 1000, viewportRatio: ratio });
        observer.disconnect();
      }, 1000);
    }, { threshold: [0.5] });
    observer.observe(root);
    return () => { if (qualifyingTimer) window.clearTimeout(qualifyingTimer); observer.disconnect(); };
  }, [campaignId, placement, productId, creativeVariantId]);

  function trackClick() {
    const attributionToken = globalThis.crypto?.randomUUID?.() || `click_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    try {
      savePendingAdAttribution({ campaignId, placement, productId: productId || null, attributionToken, clickedAt: new Date().toISOString() });
    } catch {
      // Attribution remains best-effort; the click event itself is still sent.
    }
    sendEvent({ eventType: "click", campaignId, placement, productId, attributionToken, creativeVariantId });
  }

  return <div ref={rootRef} onClickCapture={trackClick}>{children}</div>;
}
