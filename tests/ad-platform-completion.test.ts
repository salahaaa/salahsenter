import { describe, expect, it } from "vitest";
import { adDeliveryCharge, calculateAdDeliveryPacing } from "@/lib/ads/pacing";
import { assessAdClickFraud } from "@/lib/ads/fraud";
import { adInvoiceSourceKey } from "@/lib/ads/billing";
import { calculateSponsoredRanking, defaultPlacementForCampaignType, isPlacementAllowedForCampaignType } from "@/lib/ads/marketplace";
import { recommendAdBidAndBudget } from "@/lib/ads/recommendations";

describe("ads marketplace, billing and quality completion", () => {
  it("uses explicit type-to-placement compatibility and rejects a banner in product search", () => {
    expect(defaultPlacementForCampaignType("sponsored_products")).toBe("homepage_sponsored_products");
    expect(defaultPlacementForCampaignType("homepage_banner")).toBe("homepage_marketplace_ads");
    expect(isPlacementAllowedForCampaignType("homepage_banner", "search_results")).toBe(false);
    expect(isPlacementAllowedForCampaignType("featured_products", "search_results")).toBe(true);
  });

  it("prices CPM per thousand while preserving the existing budget pacing guard", () => {
    expect(adDeliveryCharge({ billingModel: "cpm", bidAmount: 100 })).toBe(0.1);
    expect(adDeliveryCharge({ billingModel: "cpc", bidAmount: 100 })).toBe(100);
    expect(calculateAdDeliveryPacing({ budget: 1, dailyBudget: 1, spentAmount: 0.9, dailySpent: 0.9, charge: 0.1 })).toMatchObject({ canServe: true, charge: 0.1, autoPauseAfterCharge: true });
  });

  it("keeps explainable suspicious traffic out of billable delivery", () => {
    const bot = assessAdClickFraud({ userAgent: "Mozilla HeadlessChrome Playwright", sameVisitorRecentClicks: 0, sameIpRecentClicks: 0 });
    const velocity = assessAdClickFraud({ userAgent: "Mozilla/5.0", sameVisitorRecentClicks: 5, sameIpRecentClicks: 5 });
    expect(bot).toMatchObject({ status: "invalid", billable: false });
    expect(bot.reasons).toContain("automation_user_agent");
    expect(velocity.billable).toBe(false);
    expect(["suspected", "invalid"]).toContain(velocity.status);
  });

  it("gives higher sponsored score to the same bid with stronger relevance, quality, health and availability", () => {
    const weak = calculateSponsoredRanking({ bid: 10, maxBid: 10, relevance: 25, quality: 25, storeHealth: 25, availability: 25 });
    const strong = calculateSponsoredRanking({ bid: 10, maxBid: 10, relevance: 90, quality: 90, storeHealth: 90, availability: 90 });
    expect(strong).toBeGreaterThan(weak);
  });

  it("makes daily invoice source keys deterministic for cron replay", () => {
    const first = adInvoiceSourceKey({ storeId: "1f3f394d-8fac-4ec5-b6a7-e6e3d5d2e1a0", currency: "YER", periodStart: new Date("2026-07-13T00:00:00.000Z") });
    const replay = adInvoiceSourceKey({ storeId: "1f3f394d-8fac-4ec5-b6a7-e6e3d5d2e1a0", currency: "YER", periodStart: new Date("2026-07-13T23:59:59.000Z") });
    expect(first).toBe(replay);
  });

  it("makes advisory recommendations protective before scaling spend", () => {
    const protectedCampaign = recommendAdBidAndBudget({ bidAmount: 20, dailyBudget: 200, budget: 1_000, spentAmount: 300, impressions: 2_000, clicks: 100, conversions: 4, spend: 300, revenue: 450, invalidClicks: 15 });
    const scalableCampaign = recommendAdBidAndBudget({ bidAmount: 20, dailyBudget: 200, budget: 1_000, spentAmount: 300, impressions: 2_000, clicks: 100, conversions: 4, spend: 100, revenue: 400, invalidClicks: 0 });
    expect(protectedCampaign.state).toBe("protect");
    expect(protectedCampaign.recommendedBid).toBeLessThan(20);
    expect(scalableCampaign.state).toBe("scale");
    expect(scalableCampaign.recommendedDailyBudget).toBeGreaterThan(200);
  });
});
