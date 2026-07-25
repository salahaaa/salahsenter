import { describe, expect, it } from "vitest";
import { funnelEventTypes, hashVisitorId } from "@/lib/analytics/funnel";

describe("commerce funnel analytics", () => {
  it("keeps the funnel vocabulary constrained", () => {
    expect(funnelEventTypes).toEqual(["product_view", "add_to_cart", "checkout_started", "order_created", "order_delivered", "product_recommendation_click"]);
  });

  it("hashes visitor identifiers instead of persisting their raw value", () => {
    const raw = "visitor-local-123456789";
    expect(hashVisitorId(raw)).not.toBe(raw);
    expect(hashVisitorId(raw)).toHaveLength(64);
    expect(hashVisitorId(raw)).toBe(hashVisitorId(raw));
  });
});
