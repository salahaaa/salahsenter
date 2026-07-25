import { describe, expect, it } from "vitest";
import { __auditInternals } from "@/lib/audit";
import { classifyRouteRateLimit, RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policy";

describe("audit correlation and central rate policy", () => {
  it("keeps audit sanitization active while correlation is stored separately", () => {
    expect(__auditInternals.sanitizeAuditValue({ password: "secret", requestId: "req-1" })).toEqual({ password: "[redacted secret]", requestId: "req-1" });
  });

  it("classifies public route classes consistently", () => {
    expect(classifyRouteRateLimit("/api/auth/login", "POST")).toBe("auth");
    expect(classifyRouteRateLimit("/api/media/upload", "POST")).toBe("upload");
    expect(classifyRouteRateLimit("/api/integrations/orders", "GET")).toBe("integration");
    expect(classifyRouteRateLimit("/api/assistant/chat", "POST")).toBe("authenticated_write");
    expect(RATE_LIMIT_POLICIES.webhook.limit).toBeGreaterThan(RATE_LIMIT_POLICIES.search.limit);
  });
});
