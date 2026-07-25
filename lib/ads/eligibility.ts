import { isVisibleBySchedule } from "@/lib/visibility-schedule";
import { calculateAdDeliveryPacing } from "@/lib/ads/pacing";

export type AdServingEligibility = {
  allowed: boolean;
  reason: "campaign_not_active" | "outside_window" | "outside_schedule" | "budget_exhausted" | null;
};

/** One policy used by renderer, tracker and pacing. A campaign cannot be
 * billable in a period where it was not eligible to be rendered. */
export function evaluateAdServingEligibility(input: {
  campaign: { status: string; startsAt?: Date | null; endsAt?: Date | null; visibilitySchedule?: Record<string, unknown> | null; billingModel?: string | null; budget?: string | number | null; dailyBudget?: string | number | null; spentAmount?: string | number | null; bidAmount?: string | number | null };
  dailySpent?: number;
  now?: Date;
}) : AdServingEligibility {
  const now = input.now || new Date();
  const campaign = input.campaign;
  if (!["approved", "active"].includes(campaign.status)) return { allowed: false, reason: "campaign_not_active" };
  if (campaign.startsAt && campaign.startsAt > now || campaign.endsAt && campaign.endsAt < now) return { allowed: false, reason: "outside_window" };
  if (!isVisibleBySchedule(campaign.visibilitySchedule || {}, now)) return { allowed: false, reason: "outside_schedule" };
  const charge = campaign.billingModel === "cpm"
    ? Math.round((Number(campaign.bidAmount || 0) / 1000) * 100) / 100
    : Number(campaign.bidAmount || 0);
  const pacing = calculateAdDeliveryPacing({ budget: campaign.budget, dailyBudget: campaign.dailyBudget, spentAmount: campaign.spentAmount, dailySpent: input.dailySpent || 0, charge });
  if (!pacing.canServe) return { allowed: false, reason: "budget_exhausted" };
  return { allowed: true, reason: null };
}
