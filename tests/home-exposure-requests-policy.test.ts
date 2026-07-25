import { describe, expect, it } from "vitest";
import { canManuallyActivateHomeExposure, canRecordFinancialCheckpoint, canReviewHomeExposureRequest, hasExplicitAdminFinalSchedule, manualActivationInitialCampaignStatus, requiresPositiveQuotedAmount } from "@/lib/home-exposure-request-policy";

describe("merchant-paid homepage exposure request policy", () => {
  it("keeps the merchant request reviewable only before campaign conversion", () => {
    expect(canReviewHomeExposureRequest("submitted", null)).toBe(true);
    expect(canReviewHomeExposureRequest("quoted", null)).toBe(true);
    expect(canReviewHomeExposureRequest("approved_pending_activation", "campaign-id")).toBe(false);
    expect(canReviewHomeExposureRequest("rejected", null)).toBe(false);
  });

  it("creates a paid request campaign paused for manual financial activation", () => {
    expect(manualActivationInitialCampaignStatus()).toBe("paused");
    expect(requiresPositiveQuotedAmount("duration")).toBe(true);
    expect(requiresPositiveQuotedAmount("conversion")).toBe(true);
  });

  it("requires a recorded invoice or payment checkpoint before manual activation", () => {
    expect(canRecordFinancialCheckpoint("awaiting_invoice", "invoice_issued")).toBe(true);
    expect(canRecordFinancialCheckpoint("awaiting_invoice", "payment_verified")).toBe(false);
    expect(canManuallyActivateHomeExposure("awaiting_invoice")).toBe(false);
    expect(canManuallyActivateHomeExposure("invoice_issued")).toBe(true);
    expect(canManuallyActivateHomeExposure("payment_verified")).toBe(true);
  });

  it("refuses to use merchant dates as an implicit final booking", () => {
    expect(hasExplicitAdminFinalSchedule({ placementId: "homepage_featured_stores", startsAt: null, endsAt: null, visibilitySchedule: null })).toBe(false);
    expect(hasExplicitAdminFinalSchedule({ placementId: "homepage_featured_stores", startsAt: "2026-08-10T07:00:00.000Z", endsAt: "2026-08-10T11:00:00.000Z", visibilitySchedule: { mode: "daily_window" } })).toBe(true);
  });
});
