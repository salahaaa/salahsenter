import { describe, expect, it } from "vitest";
import { calculateAdPerformance, utcDayRange } from "@/lib/ads/performance";

describe("ad conversion performance", () => {
  it("calculates CTR, CVR, CPC and ROAS from delivered attributed revenue", () => {
    expect(calculateAdPerformance({ impressions: 1_000, clicks: 100, conversions: 8, spend: 40, revenue: 240 })).toEqual({
      impressions: 1_000,
      clicks: 100,
      conversions: 8,
      spend: 40,
      revenue: 240,
      ctr: 10,
      cpc: 0.4,
      cvr: 8,
      roas: 6,
      invalidClicks: 0
    });
  });

  it("returns safe zero rates when no events or spend exist", () => {
    expect(calculateAdPerformance({ impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 500 })).toMatchObject({ ctr: 0, cpc: 0, cvr: 0, roas: 0 });
  });

  it("groups daily reports by Asia/Aden operational boundaries", () => {
    const { start, end } = utcDayRange(new Date("2026-07-12T23:59:59.000Z"));
    expect(start.toISOString()).toBe("2026-07-12T21:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-13T21:00:00.000Z");
  });
});
