export type CampaignBudgetSnapshot = {
  budget: number | string | null | undefined;
  dailyBudget: number | string | null | undefined;
  spentAmount: number | string | null | undefined;
  dailySpent: number | string | null | undefined;
  cpcBid: number | string | null | undefined;
};

export type AdBillingModel = "cpc" | "cpm";

export type AdBudgetLimitReason = "total_budget_exhausted" | "daily_budget_exhausted" | "budget_not_configured";

function money(value: number | string | null | undefined) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : 0;
}

/** Applies the same budget guard to a CPC click or CPM impression charge. */
export function calculateAdDeliveryPacing(input: Omit<CampaignBudgetSnapshot, "cpcBid"> & { charge: number | string | null | undefined }) {
  return calculateAdClickPacing({ ...input, cpcBid: input.charge });
}

export function adDeliveryCharge(input: { billingModel: string | null | undefined; bidAmount: number | string | null | undefined }) {
  const bid = money(input.bidAmount);
  if (input.billingModel === "cpm") return Math.round((bid / 1000) * 100) / 100;
  return bid;
}

export function calculateAdClickPacing(input: CampaignBudgetSnapshot) {
  const budget = money(input.budget);
  const dailyBudget = money(input.dailyBudget);
  const spent = money(input.spentAmount);
  const dailySpent = money(input.dailySpent);
  const cpcBid = money(input.cpcBid);
  const effectiveDailyBudget = dailyBudget > 0 ? dailyBudget : budget;
  const remainingTotal = Math.max(0, Math.round((budget - spent) * 100) / 100);
  const remainingDaily = Math.max(0, Math.round((effectiveDailyBudget - dailySpent) * 100) / 100);

  // A zero bid is explicitly a measurement-only campaign. It collects
  // sponsored visibility data but cannot accrue a financial charge.
  if (cpcBid <= 0) {
    return { billable: false, canServe: true, reason: null, charge: 0, remainingTotal, remainingDaily, autoPauseAfterCharge: false };
  }
  if (budget <= 0) {
    return { billable: true, canServe: false, reason: "budget_not_configured" as const, charge: 0, remainingTotal, remainingDaily, autoPauseAfterCharge: true };
  }
  if (remainingTotal < cpcBid) {
    return { billable: true, canServe: false, reason: "total_budget_exhausted" as const, charge: 0, remainingTotal, remainingDaily, autoPauseAfterCharge: true };
  }
  if (remainingDaily < cpcBid) {
    return { billable: true, canServe: false, reason: "daily_budget_exhausted" as const, charge: 0, remainingTotal, remainingDaily, autoPauseAfterCharge: true };
  }

  const afterTotal = Math.max(0, Math.round((remainingTotal - cpcBid) * 100) / 100);
  const afterDaily = Math.max(0, Math.round((remainingDaily - cpcBid) * 100) / 100);
  return {
    billable: true,
    canServe: true,
    reason: null,
    charge: cpcBid,
    remainingTotal,
    remainingDaily,
    autoPauseAfterCharge: afterTotal <= 0 || afterDaily <= 0
  };
}

export function campaignBudgetExhaustionReason(input: Omit<CampaignBudgetSnapshot, "cpcBid">): AdBudgetLimitReason | null {
  const budget = money(input.budget);
  const dailyBudget = money(input.dailyBudget);
  const spent = money(input.spentAmount);
  const dailySpent = money(input.dailySpent);
  if (budget > 0 && spent >= budget) return "total_budget_exhausted";
  if (dailyBudget > 0 && dailySpent >= dailyBudget) return "daily_budget_exhausted";
  return null;
}

export function adBudgetPauseMessage(reason: AdBudgetLimitReason) {
  if (reason === "daily_budget_exhausted") return "تم إيقاف الحملة تلقائيًا بعد بلوغ الميزانية اليومية.";
  if (reason === "total_budget_exhausted") return "تم إيقاف الحملة تلقائيًا بعد استهلاك الميزانية الكلية.";
  return "تم إيقاف الحملة تلقائيًا لأن سعر النقرة مفعّل دون ميزانية كلية صالحة.";
}

export function formatMoney(value: number) {
  return Math.round(value * 100) / 100;
}
