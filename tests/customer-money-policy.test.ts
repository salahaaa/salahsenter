import { describe, expect, it } from "vitest";
import { customerMoneyMode, platformIsFinancialIntermediary } from "@/lib/platform-revenue/customer-money-policy";

describe("merchant-direct customer money policy", () => {
  it("defaults to merchant collection and does not turn the platform into an intermediary", () => {
    expect(customerMoneyMode()).toBe("merchant_collects");
    expect(platformIsFinancialIntermediary()).toBe(false);
  });
});
