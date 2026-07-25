import { z } from "zod";

export const shippingCoverageSchema = z.object({
  mode: z.enum(["all_yemen", "selected_governorates", "pickup_only"]).default("all_yemen"),
  governorateIds: z.array(z.string().uuid()).max(30).default([]),
  feeOverrides: z.array(z.object({ governorateId: z.string().uuid(), fee: z.coerce.number().min(0) })).max(30).default([]),
  freeShippingThreshold: z.coerce.number().min(0).optional().nullable(),
  codEnabled: z.boolean().default(true),
  pickupAddress: z.string().trim().max(500).optional().nullable(),
  courierName: z.string().trim().max(160).optional().nullable(),
  courierPhone: z.string().trim().max(60).optional().nullable(),
  customerInstructions: z.string().trim().max(2_000).optional().nullable()
}).strict();

export type ShippingCoverage = z.infer<typeof shippingCoverageSchema>;
export type DeliveryGeo = { governorateId?: string | null; cityId?: string | null; districtId?: string | null };

/** Legacy shipping rows have no coverage JSON; preserve the existing all-Yemen behavior. */
export function normalizeShippingCoverage(value: unknown): ShippingCoverage {
  const parsed = shippingCoverageSchema.safeParse(value);
  return parsed.success ? parsed.data : { mode: "all_yemen", governorateIds: [], feeOverrides: [], freeShippingThreshold: null, codEnabled: true, pickupAddress: null, courierName: null, courierPhone: null, customerInstructions: null };
}

export function shippingMethodServesAddress(coverage: ShippingCoverage, geo: DeliveryGeo) {
  if (coverage.mode === "pickup_only") return false;
  if (coverage.mode === "all_yemen") return true;
  return Boolean(geo.governorateId && coverage.governorateIds.includes(geo.governorateId));
}

export function resolveMerchantShipping(input: { baseFee: number; coverage: ShippingCoverage; geo: DeliveryGeo; subtotal: number }) {
  const { coverage } = input;
  if (!shippingMethodServesAddress(coverage, input.geo)) {
    return { available: false, fee: 0, reason: "وسيلة الشحن لا تغطي محافظة عنوانك حالياً" };
  }
  const override = input.geo.governorateId ? coverage.feeOverrides.find((row) => row.governorateId === input.geo.governorateId) : null;
  const rawFee = override ? Number(override.fee) : Math.max(0, input.baseFee);
  const fee = coverage.freeShippingThreshold != null && input.subtotal >= Number(coverage.freeShippingThreshold) ? 0 : rawFee;
  return { available: true, fee, reason: null };
}

export function shippingCoverageSummary(coverage: ShippingCoverage) {
  return {
    mode: coverage.mode,
    codEnabled: coverage.codEnabled,
    governoratesCount: coverage.governorateIds.length,
    freeShippingThreshold: coverage.freeShippingThreshold,
    pickupAddress: coverage.pickupAddress,
    courierName: coverage.courierName,
    courierPhone: coverage.courierPhone,
    customerInstructions: coverage.customerInstructions
  };
}
