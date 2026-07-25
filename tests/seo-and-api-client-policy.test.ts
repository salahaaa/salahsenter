import { describe, expect, it } from "vitest";
import { API_CACHE_POLICY, ApiClientError } from "@/lib/client/api-client";
import { breadcrumbJsonLd } from "@/components/seo/structured-data";
import { absolutePublicUrl, cleanDescription } from "@/lib/seo";

describe("UI API and SEO quality foundations", () => {
  it("defines conservative cache policy for authenticated API calls", () => {
    expect(API_CACHE_POLICY.authenticated).toBe("no-store");
    const error = new ApiClientError({ message: "temporary", status: 503, requestId: "req-1" });
    expect(error.retryable).toBe(true);
    expect(error.requestId).toBe("req-1");
  });

  it("creates safe canonical URLs and concise metadata descriptions", () => {
    expect(absolutePublicUrl("/offers")).toContain("/offers");
    expect(cleanDescription("  وصف   طويل ", "fallback")).toBe("وصف طويل");
    expect(breadcrumbJsonLd([{ name: "الرئيسية", url: "https://example.test" }]).itemListElement).toHaveLength(1);
  });
});
