export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { db, orderPayments, orders, paymentProviderEvents } from "@/lib/db";
import { finalizePaidDeliveredStandaloneOrder } from "@/lib/commerce/order-inventory-completion";

type LocalWebhookPayload = Record<string, unknown> & {
  eventId?: unknown;
  id?: unknown;
  eventType?: unknown;
  type?: unknown;
  orderId?: unknown;
  status?: unknown;
  paymentStatus?: unknown;
  reference?: unknown;
  transactionId?: unknown;
  metadata?: { orderId?: unknown };
};

function bodyDigest(body: string) {
  return crypto.createHash("sha256").update(body).digest("hex");
}

function verifySignature(body: string, signature: string, secret: string) {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  try {
    const supplied = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    return supplied.length === expectedBuffer.length && crypto.timingSafeEqual(supplied, expectedBuffer);
  } catch {
    return false;
  }
}

function readString(value: unknown, maxLength = 180) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

async function auditWebhook(input: { eventId?: string | null; eventType?: string | null; outcome: string; orderId?: string | null; digest: string; detail?: string }) {
  await writeAuditLog({
    action: "create",
    entityType: "payment_webhook",
    entityId: input.eventId || `local_gateway:${input.digest.slice(0, 24)}`,
    afterData: {
      provider: "local_gateway",
      eventId: input.eventId || null,
      eventType: input.eventType || null,
      outcome: input.outcome,
      orderId: input.orderId || null,
      payloadSha256: input.digest,
      detail: input.detail || null
    }
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const digest = bodyDigest(body);
  const secret = process.env.LOCAL_PAYMENT_WEBHOOK_SECRET;
  const signature = request.headers.get("x-local-payment-signature") || request.headers.get("x-signature") || "";

  if (!secret) {
    await auditWebhook({ outcome: "rejected_configuration", digest, detail: "LOCAL_PAYMENT_WEBHOOK_SECRET is not configured" });
    return new NextResponse("Webhook is not configured", { status: 503 });
  }
  if (!verifySignature(body, signature, secret)) {
    await auditWebhook({ outcome: "rejected_signature", digest, detail: "Local gateway signature validation failed" });
    return new NextResponse("Invalid signature", { status: 400 });
  }

  let payload: LocalWebhookPayload;
  try {
    payload = JSON.parse(body) as LocalWebhookPayload;
  } catch {
    await auditWebhook({ outcome: "rejected_payload", digest, detail: "Invalid JSON" });
    return new NextResponse("Invalid payload", { status: 400 });
  }

  const eventId = readString(payload.eventId) || readString(payload.id);
  const eventType = readString(payload.eventType, 120) || readString(payload.type, 120) || "payment.updated";
  const orderId = readString(payload.orderId) || readString(payload.metadata?.orderId);
  const reference = readString(payload.reference) || readString(payload.transactionId);
  const status = String(payload.status || payload.paymentStatus || "").trim().toLowerCase();
  if (!eventId) {
    await auditWebhook({ eventType, outcome: "rejected_payload", orderId, digest, detail: "A stable provider eventId or id is required for replay protection" });
    return new NextResponse("Missing event identity", { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      // The unique event record is the replay barrier. A duplicate cannot make
      // a second mutation, even when the provider retries the same webhook.
      const [storedEvent] = await tx
        .insert(paymentProviderEvents)
        .values({ provider: "local_gateway", eventId, eventType, payload, processedAt: new Date() })
        .onConflictDoNothing()
        .returning({ id: paymentProviderEvents.id });
      if (!storedEvent) return { outcome: "duplicate" as const, orderId };

      if (!orderId || !reference) return { outcome: "recorded_missing_reference" as const, orderId };
      const isPaid = ["paid", "success", "succeeded", "captured"].includes(status);
      const isFailed = ["failed", "cancelled", "canceled"].includes(status);
      if (!isPaid && !isFailed) return { outcome: "recorded" as const, orderId };

      const nextStatus = isPaid ? "paid" : "failed";
      const updatedPayments = await tx
        .update(orderPayments)
        .set({ status: nextStatus, transactionReference: reference, providerResponse: payload, ...(isPaid ? { paidAt: new Date() } : {}), updatedAt: new Date() })
        .where(and(eq(orderPayments.orderId, orderId), eq(orderPayments.transactionReference, reference)))
        .returning({ id: orderPayments.id });
      if (!updatedPayments.length) return { outcome: "ignored_unmatched_payment" as const, orderId };

      await tx.update(orders).set({ paymentStatus: nextStatus, updatedAt: new Date() }).where(eq(orders.id, orderId));
      if (isPaid) await finalizePaidDeliveredStandaloneOrder(tx, { orderId, actorId: null });
      return { outcome: nextStatus, orderId };
    });

    await auditWebhook({ eventId, eventType, outcome: result.outcome, orderId: result.orderId, digest });
    return NextResponse.json({ received: true, duplicate: result.outcome === "duplicate" });
  } catch (error) {
    await auditWebhook({ eventId, eventType, outcome: "processing_error", orderId, digest, detail: error instanceof Error ? error.message : "Unknown processing error" });
    return new NextResponse("Webhook processing failed", { status: 500 });
  }
}
