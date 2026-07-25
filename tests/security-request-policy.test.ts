import { describe, expect, it } from "vitest";
import { hasMachineIntegrationCredential, isMachineIntegrationRequest, isSignedPaymentWebhook } from "@/lib/security-request-policy";
import { isPublicCommerceBlocked } from "@/lib/platform-operation-policy";

describe("non-blocking admin security request policy", () => {
  it("exempts integration mutations from CSRF only when a machine credential is present", () => {
    expect(isMachineIntegrationRequest("/api/integrations/inventory", new Headers())).toBe(false);
    expect(isMachineIntegrationRequest("/api/integrations/inventory", new Headers({ "x-api-key": "short" }))).toBe(false);
    expect(isMachineIntegrationRequest("/api/integrations/inventory", new Headers({ "x-api-key": "a".repeat(32) }))).toBe(true);
    expect(hasMachineIntegrationCredential(new Headers({ authorization: "Bearer token-value" }))).toBe(true);
    expect(isSignedPaymentWebhook("/api/payments/stripe/webhook")).toBe(true);
    expect(isSignedPaymentWebhook("/api/payments/stripe/webhook/extra")).toBe(false);
  });

  it("blocks customer commerce during lockdown but contains no admin decision policy", () => {
    expect(isPublicCommerceBlocked({ emergencyLockdown: false, maintenanceMode: false, securityLevel: "normal" })).toBe(false);
    expect(isPublicCommerceBlocked({ emergencyLockdown: true, maintenanceMode: false, securityLevel: "normal" })).toBe(true);
    expect(isPublicCommerceBlocked({ emergencyLockdown: false, maintenanceMode: true, securityLevel: "heightened" })).toBe(true);
  });
});
