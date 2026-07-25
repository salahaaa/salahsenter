export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { db, orderPayments, orders, paymentProviderEvents } from "@/lib/db";
import { finalizePaidDeliveredStandaloneOrder } from "@/lib/commerce/order-inventory-completion";
import { verifyStripeSignature } from "@/lib/payments/gateway";

type StripeEvent = {
  id?: string;
  type?: string;
  data?: {
    object?: {
      id?: string;
      metadata?: { orderId?: string };
      client_reference_id?: string;
      payment_status?: string;
    };
  };
};

function bodyDigest(body: string) {
  return crypto.createHash("sha256").update(body).digest("hex");
}

async function auditWebhook(input: { eventId?: string | null; eventType?: string | null; outcome: string; orderId?: string | null; digest: string; detail?: string }) {
  await writeAuditLog({
    action: "create",
    entityType: "payment_webhook",
    entityId: input.eventId || `stripe:${input.digest.slice(0, 24)}`,
    afterData: {
      provider: "stripe",
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
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature") || "";

  if (!secret) {
    await auditWebhook({ outcome: "rejected_configuration", digest, detail: "STRIPE_WEBHOOK_SECRET is not configured" });
    return new NextResponse("Webhook is not configured", { status: 503 });
  }
  if (!verifyStripeSignature({ body, signature, secret })) {
    await auditWebhook({ outcome: "rejected_signature", digest, detail: "Stripe signature validation failed" });
    return new NextResponse("Invalid signature", { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(body) as StripeEvent;
  } catch {
    await auditWebhook({ outcome: "rejected_payload", digest, detail: "Invalid JSON" });
    return new NextResponse("Invalid payload", { status: 400 });
  }

  if (!event.id || !event.type || event.id.length > 180 || event.type.length > 120) {
    await auditWebhook({ eventId: event.id, eventType: event.type, outcome: "rejected_payload", digest, detail: "Missing or invalid event identity" });
    return new NextResponse("Invalid event identity", { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      // The unique provider+event index is the replay barrier. Crucially, an
      // existing event exits before any order/payment mutation is attempted.
      const [storedEvent] = await tx
        .insert(paymentProviderEvents)
        .values({ provider: "stripe", eventId: event.id!, eventType: event.type!, payload: event as Record<string, unknown>, processedAt: new Date() })
        .onConflictDoNothing()
        .returning({ id: paymentProviderEvents.id });
      if (!storedEvent) return { outcome: "duplicate" as const, orderId: null };

      const session = event.data?.object;
      const orderId = session?.metadata?.orderId || session?.client_reference_id || null;
      const paidEvent = event.type === "checkout.session.async_payment_succeeded" || (event.type === "checkout.session.completed" && session?.payment_status === "paid");
      if (!paidEvent || !orderId || !session?.id) return { outcome: "recorded" as const, orderId };

      // Only a previously-created payment session for this exact order may
      // transition the order to paid. Metadata alone is not trusted.
      const updatedPayments = await tx
        .update(orderPayments)
        .set({ status: "paid", transactionReference: session.id, providerResponse: session, paidAt: new Date(), updatedAt: new Date() })
        .where(and(eq(orderPayments.orderId, orderId), eq(orderPayments.transactionReference, session.id)))
        .returning({ id: orderPayments.id });
      if (!updatedPayments.length) return { outcome: "ignored_unmatched_payment" as const, orderId };

      await tx.update(orders).set({ paymentStatus: "paid", updatedAt: new Date() }).where(eq(orders.id, orderId));
      await finalizePaidDeliveredStandaloneOrder(tx, { orderId, actorId: null });
      return { outcome: "paid" as const, orderId };
    });

    await auditWebhook({ eventId: event.id, eventType: event.type, outcome: result.outcome, orderId: result.orderId, digest });
    return NextResponse.json({ received: true, duplicate: result.outcome === "duplicate" });
  } catch (error) {
    await auditWebhook({ eventId: event.id, eventType: event.type, outcome: "processing_error", digest, detail: error instanceof Error ? error.message : "Unknown processing error" });
    return new NextResponse("Webhook processing failed", { status: 500 });
  }
}
