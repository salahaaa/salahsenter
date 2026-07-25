import { describe, expect, it } from "vitest";
import {
  addonIsDueInPeriod,
  calculatePlatformRevenueStatement,
  monthRange,
  previousMonthRange,
  statementNeedsApprovedSalesReport,
  usesMonthlyRent,
  usesSalesCommission
} from "@/lib/platform-revenue/policy";

describe("platform-only consolidated revenue policy", () => {
  it("separates rent-only, commission-only and hybrid commercial models", () => {
    expect(usesMonthlyRent("monthly_rent")).toBe(true);
    expect(usesSalesCommission("monthly_rent")).toBe(false);
    expect(usesMonthlyRent("sales_commission")).toBe(false);
    expect(usesSalesCommission("sales_commission")).toBe(true);
    expect(usesMonthlyRent("hybrid")).toBe(true);
    expect(usesSalesCommission("hybrid")).toBe(true);
    expect(statementNeedsApprovedSalesReport("monthly_rent")).toBe(false);
    expect(statementNeedsApprovedSalesReport("hybrid")).toBe(true);
  });

  it("calculates a unified statement without treating customer payments as platform funds", () => {
    expect(calculatePlatformRevenueStatement({
      model: "hybrid",
      monthlyRent: 10_000,
      commissionRate: 5,
      approvedSalesTotal: 80_000,
      advertisingAmount: 2_000,
      addonsAmount: 500
    })).toEqual({
      rentAmount: 10_000,
      commissionBase: 80_000,
      commissionRate: 5,
      commissionAmount: 4_000,
      advertisingAmount: 2_000,
      addonsAmount: 500,
      adjustmentAmount: 0,
      totalAmount: 16_500
    });
  });

  it("does not add rent to a commission-only merchant", () => {
    const statement = calculatePlatformRevenueStatement({ model: "sales_commission", monthlyRent: 10_000, commissionRate: 7.5, approvedSalesTotal: 1_000, advertisingAmount: 0 });
    expect(statement.rentAmount).toBe(0);
    expect(statement.commissionAmount).toBe(75);
    expect(statement.totalAmount).toBe(75);
  });

  it("uses stable UTC calendar periods for the monthly revenue cycle", () => {
    expect(monthRange(new Date("2026-07-14T12:00:00.000Z"))).toEqual({ start: new Date("2026-07-01T00:00:00.000Z"), end: new Date("2026-08-01T00:00:00.000Z") });
    expect(previousMonthRange(new Date("2026-07-14T12:00:00.000Z"))).toEqual({ start: new Date("2026-06-01T00:00:00.000Z"), end: new Date("2026-07-01T00:00:00.000Z") });
  });

  it("bills non-monthly add-ons only in their configured cycle", () => {
    const startsAt = new Date("2026-01-01T00:00:00.000Z");
    expect(addonIsDueInPeriod({ startsAt, periodStart: new Date("2026-01-01T00:00:00.000Z"), billingCycle: "quarterly" })).toBe(true);
    expect(addonIsDueInPeriod({ startsAt, periodStart: new Date("2026-02-01T00:00:00.000Z"), billingCycle: "quarterly" })).toBe(false);
    expect(addonIsDueInPeriod({ startsAt, periodStart: new Date("2026-04-01T00:00:00.000Z"), billingCycle: "quarterly" })).toBe(true);
  });
});
