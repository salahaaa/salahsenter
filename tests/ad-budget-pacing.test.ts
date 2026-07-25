import { describe, expect, it } from "vitest";
import { adBudgetPauseMessage, calculateAdClickPacing, campaignBudgetExhaustionReason } from "@/lib/ads/pacing";

describe("ad campaign budget pacing", () => {
  it("keeps zero-bid campaigns measurement-only", () => {
    expect(calculateAdClickPacing({ budget: 1000, dailyBudget: 100, spentAmount: 0, dailySpent: 0, cpcBid: 0 })).toMatchObject({ billable: false, canServe: true, charge: 0, autoPauseAfterCharge: false });
  });

  it("accrues a CPC click and pauses after consuming the total budget", () => {
    expect(calculateAdClickPacing({ budget: 10, dailyBudget: 0, spentAmount: 8, dailySpent: 8, cpcBid: 2 })).toMatchObject({ billable: true, canServe: true, charge: 2, autoPauseAfterCharge: true });
  });

  it("stops serving before exceeding daily or total budget", () => {
    const daily = calculateAdClickPacing({ budget: 100, dailyBudget: 10, spentAmount: 40, dailySpent: 9, cpcBid: 2 });
    const total = calculateAdClickPacing({ budget: 10, dailyBudget: 10, spentAmount: 9, dailySpent: 4, cpcBid: 2 });

    expect(daily).toMatchObject({ canServe: false, reason: "daily_budget_exhausted", charge: 0 });
    expect(total).toMatchObject({ canServe: false, reason: "total_budget_exhausted", charge: 0 });
  });

  it("reports an actionable exhaustion reason for the cron backstop", () => {
    expect(campaignBudgetExhaustionReason({ budget: 100, dailyBudget: 20, spentAmount: 30, dailySpent: 20 })).toBe("daily_budget_exhausted");
    expect(campaignBudgetExhaustionReason({ budget: 100, dailyBudget: 20, spentAmount: 100, dailySpent: 2 })).toBe("total_budget_exhausted");
    expect(adBudgetPauseMessage("daily_budget_exhausted")).toContain("الميزانية اليومية");
  });
});
