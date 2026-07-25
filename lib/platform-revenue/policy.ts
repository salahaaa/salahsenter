export const PLATFORM_REVENUE_MODELS = ["monthly_rent", "sales_commission", "hybrid"] as const;
export type PlatformRevenueModel = (typeof PLATFORM_REVENUE_MODELS)[number];

export function usesMonthlyRent(model: PlatformRevenueModel) {
  return model === "monthly_rent" || model === "hybrid";
}

export function usesSalesCommission(model: PlatformRevenueModel) {
  return model === "sales_commission" || model === "hybrid";
}

function money(value: number | string | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : 0;
}

export function calculatePlatformRevenueStatement(input: {
  model: PlatformRevenueModel;
  monthlyRent: number | string | null | undefined;
  commissionRate: number | string | null | undefined;
  approvedSalesTotal?: number | string | null;
  advertisingAmount?: number | string | null;
  addonsAmount?: number | string | null;
  adjustmentAmount?: number | string | null;
}) {
  const monthlyRent = usesMonthlyRent(input.model) ? money(input.monthlyRent) : 0;
  const commissionBase = usesSalesCommission(input.model) ? money(input.approvedSalesTotal) : 0;
  const commissionRate = usesSalesCommission(input.model) ? money(input.commissionRate) : 0;
  const commissionAmount = Math.round((commissionBase * commissionRate / 100) * 100) / 100;
  const advertisingAmount = money(input.advertisingAmount);
  const addonsAmount = money(input.addonsAmount);
  const adjustmentAmount = money(input.adjustmentAmount);
  return {
    rentAmount: monthlyRent,
    commissionBase,
    commissionRate,
    commissionAmount,
    advertisingAmount,
    addonsAmount,
    adjustmentAmount,
    totalAmount: Math.round((monthlyRent + commissionAmount + advertisingAmount + addonsAmount + adjustmentAmount) * 100) / 100
  };
}

export function statementNeedsApprovedSalesReport(model: PlatformRevenueModel) {
  return usesSalesCommission(model);
}

export function monthRange(value = new Date()) {
  const start = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  const end = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1));
  return { start, end };
}

export function previousMonthRange(value = new Date()) {
  return monthRange(new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() - 1, 1)));
}

export function periodKey(start: Date) {
  return start.toISOString().slice(0, 7);
}

/** Determines whether an add-on cycle lands in a given monthly platform statement. */
export function addonIsDueInPeriod(input: { startsAt: Date; periodStart: Date; billingCycle: string }) {
  const startMonth = input.startsAt.getUTCFullYear() * 12 + input.startsAt.getUTCMonth();
  const periodMonth = input.periodStart.getUTCFullYear() * 12 + input.periodStart.getUTCMonth();
  const elapsed = periodMonth - startMonth;
  if (elapsed < 0) return false;
  const cycleMonths: Record<string, number> = { monthly: 1, quarterly: 3, semi_annual: 6, annual: 12 };
  return elapsed % (cycleMonths[input.billingCycle] || 1) === 0;
}
