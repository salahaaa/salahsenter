import { describe, expect, it } from "vitest";
import { canApplyErpOnboardingAction } from "@/lib/integrations/erp/onboarding-policy";

describe("generic ERP onboarding lifecycle", () => {
  it("requires review before connector assignment", () => {
    expect(canApplyErpOnboardingAction("pending_review", "assign_connector")).toBe(false);
    expect(canApplyErpOnboardingAction("under_review", "assign_connector")).toBe(true);
  });
  it("requires mapping readiness and certification before activation", () => {
    expect(canApplyErpOnboardingAction("approved_for_setup", "activate")).toBe(false);
    expect(canApplyErpOnboardingAction("mapping_in_progress", "activate")).toBe(false);
    expect(canApplyErpOnboardingAction("ready_for_certification", "activate")).toBe(true);
  });
  it("does not allow a terminal request to be reviewed or reassigned", () => {
    expect(canApplyErpOnboardingAction("activated", "start_review")).toBe(false);
    expect(canApplyErpOnboardingAction("rejected", "assign_connector")).toBe(false);
  });
});
