import { describe, expect, it } from "vitest";
import { exposureCapReason, normalizeHomeExposureCampaignConfig, normalizeHomeExposureEngineSettings } from "@/lib/home-exposure";
import { isVisibleBySchedule } from "@/lib/visibility-schedule";

describe("dynamic homepage exposure engine policy", () => {
  it("normalizes commercial caps without treating absent caps as a limit", () => {
    const config = normalizeHomeExposureCampaignConfig({ manualPriority: "12", rotationWeight: "2.5", impressionCap: "1000", clickCap: "500", commercialModel: "cpc", paidPriority: true, targetType: "store" });
    expect(config).toMatchObject({ manualPriority: 12, rotationWeight: 2.5, impressionCap: 1000, clickCap: 500, commercialModel: "cpc", paidPriority: true });
    expect(exposureCapReason(config, { impressions: 999, clicks: 500, cleanClicks: 499, conversions: 0, attributedRevenue: 0, platformRevenue: 0 })).toBeNull();
    expect(exposureCapReason(config, { impressions: 1000, clicks: 500, cleanClicks: 499, conversions: 0, attributedRevenue: 0, platformRevenue: 0 })).toBe("impression_cap");
    expect(exposureCapReason({ ...config, impressionCap: 0 }, { impressions: 5000, clicks: 500, cleanClicks: 500, conversions: 0, attributedRevenue: 0, platformRevenue: 0 })).toBe("click_cap");
  });

  it("supports first-week-of-month and weekly evening schedules in Asia/Aden", () => {
    expect(isVisibleBySchedule({ mode: "monthly_first_week", timezone: "Asia/Aden", startTime: "10:00", endTime: "12:00" }, new Date("2026-08-01T07:30:00.000Z"))).toBe(true);
    expect(isVisibleBySchedule({ mode: "monthly_first_week", timezone: "Asia/Aden", startTime: "10:00", endTime: "12:00" }, new Date("2026-08-08T07:30:00.000Z"))).toBe(false);
    expect(isVisibleBySchedule({ mode: "weekly_window", timezone: "Asia/Aden", weekDays: [5], startTime: "18:00", endTime: "00:00" }, new Date("2026-08-07T16:00:00.000Z"))).toBe(true);
  });

  it("keeps every placement policy bounded and fair by default", () => {
    const settings = normalizeHomeExposureEngineSettings({ policies: { homepage_featured_stores: { limit: 99, maxItemsPerStore: 99, rotationIntervalMinutes: 0, rankingMode: "fair_rotation" } } });
    expect(settings.policies.homepage_featured_stores).toMatchObject({ enabled: true, limit: 12, maxItemsPerStore: 6, rotationIntervalMinutes: 5, rankingMode: "fair_rotation" });
    expect(settings.policies.homepage_today_offers.maxItemsPerStore).toBeGreaterThanOrEqual(1);
  });
});
