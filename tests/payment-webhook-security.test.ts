import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { verifyStripeSignature } from "@/lib/payments/gateway";

describe("Stripe webhook signature verification", () => {
  const secret = "webhook-test-secret";
  const body = JSON.stringify({ id: "evt-1", type: "checkout.session.completed" });
  const nowMs = 1_800_000_000_000;

  function signature(timestamp: number) {
    const digest = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    return `t=${timestamp},v1=${digest}`;
  }

  it("accepts an authenticated current payload", () => {
    const timestamp = Math.floor(nowMs / 1000);
    expect(verifyStripeSignature({ body, secret, signature: signature(timestamp), nowMs })).toBe(true);
  });

  it("rejects a stale otherwise-valid payload to limit replay", () => {
    const staleTimestamp = Math.floor(nowMs / 1000) - 301;
    expect(verifyStripeSignature({ body, secret, signature: signature(staleTimestamp), nowMs })).toBe(false);
  });

  it("rejects a modified payload", () => {
    const timestamp = Math.floor(nowMs / 1000);
    expect(verifyStripeSignature({ body: `${body}x`, secret, signature: signature(timestamp), nowMs })).toBe(false);
  });
});
