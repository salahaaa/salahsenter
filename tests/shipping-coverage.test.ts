import { describe, expect, it } from "vitest";
import { normalizeShippingCoverage, resolveMerchantShipping, shippingMethodServesAddress } from "@/lib/shipping/coverage";

const governorateA = "00000000-0000-0000-0000-000000000001";
const governorateB = "00000000-0000-0000-0000-000000000002";

describe("merchant shipping coverage", () => {
  it("keeps legacy empty config available across Yemen", () => {
    const coverage = normalizeShippingCoverage({});
    expect(shippingMethodServesAddress(coverage, { governorateId: governorateA })).toBe(true);
  });

  it("filters selected governorates and resolves their fee override", () => {
    const coverage = normalizeShippingCoverage({ mode: "selected_governorates", governorateIds: [governorateA], feeOverrides: [{ governorateId: governorateA, fee: 900 }], codEnabled: true });
    expect(resolveMerchantShipping({ baseFee: 500, coverage, geo: { governorateId: governorateA }, subtotal: 1000 })).toEqual(expect.objectContaining({ available: true, fee: 900 }));
    expect(resolveMerchantShipping({ baseFee: 500, coverage, geo: { governorateId: governorateB }, subtotal: 1000 })).toEqual(expect.objectContaining({ available: false }));
  });

  it("applies free shipping threshold after matching coverage", () => {
    const coverage = normalizeShippingCoverage({ mode: "all_yemen", governorateIds: [], feeOverrides: [], freeShippingThreshold: 5000, codEnabled: true });
    expect(resolveMerchantShipping({ baseFee: 1000, coverage, geo: { governorateId: governorateA }, subtotal: 5000 })).toEqual(expect.objectContaining({ available: true, fee: 0 }));
  });
});
