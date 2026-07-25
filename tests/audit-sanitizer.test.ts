import { describe, expect, it } from "vitest";
import { __auditInternals } from "@/lib/audit";

describe("audit sanitizer", () => {
  it("redacts inline base64 media before storing audit logs", () => {
    const dataUrl = `data:image/png;base64,${"a".repeat(5000)}`;
    const result = __auditInternals.sanitizeAuditValue({ imageUrl: dataUrl, nested: { gallery: [dataUrl] } }) as any;
    expect(result.imageUrl).toContain("redacted inline media");
    expect(result.nested.gallery[0]).toContain("redacted inline media");
  });

  it("truncates long strings", () => {
    const result = __auditInternals.sanitizeAuditValue({ text: "x".repeat(3000) }) as any;
    expect(result.text.length).toBeLessThan(2100);
    expect(result.text).toContain("truncated");
  });

  it("redacts credential-like fields before audit persistence", () => {
    const result = __auditInternals.sanitizeAuditValue({ apiKey: "private-value", authorizationHeader: "Bearer private-value", nested: { webhookSecret: "private-value" } }) as any;
    expect(result.apiKey).toBe("[redacted secret]");
    expect(result.authorizationHeader).toBe("[redacted secret]");
    expect(result.nested.webhookSecret).toBe("[redacted secret]");
  });

  it("classifies operational audit events consistently", () => {
    expect(__auditInternals.inferAuditCategory("financial.merchant_payout_request")).toBe("financial");
    expect(__auditInternals.inferAuditCategory("inventory.order_reservation")).toBe("inventory");
    expect(__auditInternals.inferAuditCategory("security.admin_sessions_revoked")).toBe("security");
    expect(__auditInternals.inferAuditCategory("store_settings")).toBe("administrative");
  });
});
