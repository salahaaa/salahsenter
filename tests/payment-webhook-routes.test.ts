import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = { insert: vi.fn(), update: vi.fn() };
  return {
    tx,
    transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
  };
});

vi.mock("@/lib/db", () => ({
  db: { transaction: mocks.transaction },
  orders: { id: "orders.id", paymentStatus: "orders.paymentStatus", updatedAt: "orders.updatedAt" },
  orderPayments: { id: "orderPayments.id", orderId: "orderPayments.orderId", transactionReference: "orderPayments.transactionReference", status: "orderPayments.status", providerResponse: "orderPayments.providerResponse", paidAt: "orderPayments.paidAt", updatedAt: "orderPayments.updatedAt" },
  paymentProviderEvents: { id: "paymentProviderEvents.id" }
}));
vi.mock("@/lib/audit", () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { POST as stripeWebhook } from "@/app/api/payments/stripe/webhook/route";
import { POST as localWebhook } from "@/app/api/payments/local-gateway/webhook/route";

describe("payment webhook routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) }) });
  });

  it("fails closed when the Stripe secret is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const response = await stripeWebhook(new Request("http://localhost/api/payments/stripe/webhook", { method: "POST", body: "{}" }));
    expect(response.status).toBe(503);
  });

  it("treats a duplicate signed Stripe event as a replay without an order mutation", async () => {
    const secret = "stripe-route-test-secret";
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    const body = JSON.stringify({ id: "evt_replay_1", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: "paid", metadata: { orderId: "00000000-0000-0000-0000-000000000001" } } } });
    const timestamp = Math.floor(Date.now() / 1000);
    const digest = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    const response = await stripeWebhook(new Request("http://localhost/api/payments/stripe/webhook", { method: "POST", headers: { "stripe-signature": `t=${timestamp},v1=${digest}` }, body }));
    expect(response.status).toBe(200);
    expect((await response.json()).duplicate).toBe(true);
    expect(mocks.tx.update).not.toHaveBeenCalled();
  });

  it("fails closed when the local gateway secret is missing or the signature is invalid", async () => {
    delete process.env.LOCAL_PAYMENT_WEBHOOK_SECRET;
    const noSecret = await localWebhook(new Request("http://localhost/api/payments/local-gateway/webhook", { method: "POST", body: "{}" }));
    expect(noSecret.status).toBe(503);

    process.env.LOCAL_PAYMENT_WEBHOOK_SECRET = "local-route-test-secret";
    const invalid = await localWebhook(new Request("http://localhost/api/payments/local-gateway/webhook", { method: "POST", headers: { "x-local-payment-signature": "00" }, body: "{}" }));
    expect(invalid.status).toBe(400);
  });
});
