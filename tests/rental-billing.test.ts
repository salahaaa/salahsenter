import { describe, expect, it } from "vitest";
import { nextRentalCycleDate } from "@/lib/rentals/service";

describe("hybrid rental billing cycles", () => {
  const start = new Date("2026-01-15T00:00:00.000Z");
  it("calculates monthly, quarterly, semiannual and annual next dates", () => {
    expect(nextRentalCycleDate(start, "monthly").toISOString()).toContain("2026-02-15");
    expect(nextRentalCycleDate(start, "quarterly").toISOString()).toContain("2026-04-15");
    expect(nextRentalCycleDate(start, "semi_annual").toISOString()).toContain("2026-07-15");
    expect(nextRentalCycleDate(start, "annual").toISOString()).toContain("2027-01-15");
  });
});
