export const homeExposureRequestStatuses = ["submitted", "quoted", "approved_pending_activation", "rejected", "cancelled"] as const;
export type HomeExposureRequestStatus = (typeof homeExposureRequestStatuses)[number];

/** A merchant request can be quoted/rejected/converted only before it creates a campaign. */
export function canReviewHomeExposureRequest(status: string, campaignId?: string | null) {
  return !campaignId && (status === "submitted" || status === "quoted");
}

/** The selected policy deliberately refuses automatic activation on invoice/payment assumptions. */
export function manualActivationInitialCampaignStatus() {
  return "paused" as const;
}

export function requiresPositiveQuotedAmount(model: string) {
  return ["duration", "cpc", "cpm", "visit", "conversion"].includes(model);
}

/** Merchant-proposed dates are intentionally never accepted as an implicit fallback. */
export function hasExplicitAdminFinalSchedule(input: { placementId?: string | null; startsAt?: string | null; endsAt?: string | null; visibilitySchedule?: unknown }) {
  return Boolean(input.placementId && input.startsAt && input.endsAt && input.visibilitySchedule && typeof input.visibilitySchedule === "object");
}

export const homeExposureFinancialCheckpointStatuses = ["awaiting_invoice", "invoice_issued", "payment_verified"] as const;
export type HomeExposureFinancialCheckpointStatus = (typeof homeExposureFinancialCheckpointStatuses)[number];

export function canRecordFinancialCheckpoint(current: string, next: string) {
  if (next === "invoice_issued") return current === "awaiting_invoice" || current === "invoice_issued";
  if (next === "payment_verified") return current === "invoice_issued" || current === "payment_verified";
  return false;
}

/** Manual activation may follow invoice issue or payment verification, never an unreviewed request. */
export function canManuallyActivateHomeExposure(financialCheckpointStatus: string | null | undefined) {
  return financialCheckpointStatus === "invoice_issued" || financialCheckpointStatus === "payment_verified";
}
