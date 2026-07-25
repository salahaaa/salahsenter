import { and, desc, eq, lte, or, sql } from "drizzle-orm";
import { db, backgroundJobs, notifications } from "@/lib/db";
import { awardLoyaltyForOrder } from "@/lib/enterprise/wallet";
import { notifyAdmins } from "@/lib/notifications";
import { sendTransactionalMessage } from "@/lib/outbound";
import { logEvent, measureAsync } from "@/lib/observability/logger";
import { processAccountingIntegrationEvent } from "@/lib/integrations/accounting/apply";

type JobRow = typeof backgroundJobs.$inferSelect;

type OrderCreatedPayload = {
  storeMerchantId: string;
  storeId: string;
  orderId: string;
  orderNumber: string;
  storeName: string;
};

type OrderStatusUpdatedPayload = {
  customerId: string;
  storeId: string;
  orderId: string;
  statusCode: string;
  statusName: string;
};

type LoyaltyPayload = {
  userId: string;
  orderId: string;
  amount: number;
  currency: string;
};

async function claimJobs(limit: number, queue = "default") {
  const now = new Date();
  const candidates = await db
    .select()
    .from(backgroundJobs)
    .where(and(
      eq(backgroundJobs.queue, queue),
      or(eq(backgroundJobs.status, "queued"), eq(backgroundJobs.status, "retry")),
      lte(backgroundJobs.availableAt, now)
    ))
    .orderBy(desc(backgroundJobs.priority), backgroundJobs.createdAt)
    .limit(limit);

  const claimed: JobRow[] = [];
  const lockedUntil = new Date(Date.now() + 5 * 60 * 1000);
  for (const job of candidates) {
    const [row] = await db
      .update(backgroundJobs)
      .set({ status: "processing", attempts: sql`${backgroundJobs.attempts} + 1`, lockedAt: new Date(), lockedUntil, updatedAt: new Date() })
      .where(and(
        eq(backgroundJobs.id, job.id),
        or(eq(backgroundJobs.status, "queued"), eq(backgroundJobs.status, "retry"))
      ))
      .returning();
    if (row) claimed.push(row);
  }
  return claimed;
}

async function markCompleted(jobId: string) {
  await db.update(backgroundJobs).set({ status: "completed", completedAt: new Date(), lockedUntil: null, updatedAt: new Date() }).where(eq(backgroundJobs.id, jobId));
}

async function markFailed(job: JobRow, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const retry = job.attempts < job.maxAttempts;
  const delayMs = Math.min(30 * 60 * 1000, Math.max(10_000, 2 ** Math.max(0, job.attempts - 1) * 10_000));
  await db
    .update(backgroundJobs)
    .set({
      status: retry ? "retry" : "dead_letter",
      failedAt: retry ? null : new Date(),
      deadLetteredAt: retry ? null : new Date(),
      deadLetterReason: retry ? null : message.slice(0, 5000),
      availableAt: retry ? new Date(Date.now() + delayMs) : job.availableAt,
      lockedUntil: null,
      lastError: message.slice(0, 5000),
      updatedAt: new Date()
    })
    .where(eq(backgroundJobs.id, job.id));
}

async function handleOrderCreated(payload: OrderCreatedPayload) {
  // Customer/merchant in-app notifications are created synchronously in the order transaction
  // so users see them immediately. The background job keeps platform/admin notifications out
  // of the checkout request lifecycle.
  await notifyAdmins({
    title: "طلب جديد داخل المنصة",
    body: `تم إنشاء طلب ${payload.orderNumber} في متجر ${payload.storeName}.`,
    type: "admin_new_order",
    data: { orderId: payload.orderId, storeId: payload.storeId, url: "/admin" }
  });
}

async function handleOrderStatusUpdated(payload: OrderStatusUpdatedPayload) {
  await db.insert(notifications).values({
    userId: payload.customerId,
    storeId: payload.storeId,
    title: "تم تحديث حالة طلبك",
    body: `الحالة الجديدة: ${payload.statusName}`,
    type: "order_status_updated",
    data: { orderId: payload.orderId, statusCode: payload.statusCode }
  });
}

async function handleLoyalty(payload: LoyaltyPayload) {
  await awardLoyaltyForOrder({ userId: payload.userId, orderId: payload.orderId, amount: payload.amount, currency: payload.currency });
}

async function processJob(job: JobRow) {
  switch (job.type) {
    case "notifications.order_created":
      await handleOrderCreated(job.payload as OrderCreatedPayload);
      break;
    case "notifications.order_status_updated":
      await handleOrderStatusUpdated(job.payload as OrderStatusUpdatedPayload);
      break;
    case "wallet.award_loyalty":
      await handleLoyalty(job.payload as LoyaltyPayload);
      break;
    case "analytics.product_view":
      // Placeholder for the next analytics phase: Redis counters / batch flush.
      break;
    case "outbound.message":
      await sendTransactionalMessage(job.payload as any);
      break;
    case "integrations.accounting.sync":
    case "integrations.accounting.dispatch": {
      const payload = job.payload as { integrationEventId?: string | null };
      if (payload.integrationEventId) await processAccountingIntegrationEvent(payload.integrationEventId);
      break;
    }
    default:
      throw new Error(`Unknown background job type: ${job.type}`);
  }
}

/** Operator-controlled replay of a dead-lettered job after the root cause is fixed. */
export async function requeueDeadLetterJob(jobId: string) {
  const [job] = await db
    .update(backgroundJobs)
    .set({ status: "queued", attempts: 0, availableAt: new Date(), lockedAt: null, lockedUntil: null, deadLetteredAt: null, deadLetterReason: null, updatedAt: new Date() })
    .where(and(eq(backgroundJobs.id, jobId), eq(backgroundJobs.status, "dead_letter")))
    .returning({ id: backgroundJobs.id, type: backgroundJobs.type, queue: backgroundJobs.queue });
  return job || null;
}

export async function processDueJobs(options: { limit?: number; queue?: string } = {}) {
  const limit = Math.min(Math.max(Number(options.limit || 25), 1), 100);
  const queue = options.queue || "default";
  const jobs = await claimJobs(limit, queue);
  const summary = { claimed: jobs.length, completed: 0, failed: 0 };

  for (const job of jobs) {
    try {
      await measureAsync("background_job.process", () => processJob(job), { jobId: job.id, type: job.type, queue: job.queue, attempt: job.attempts });
      await markCompleted(job.id);
      summary.completed += 1;
    } catch (error) {
      summary.failed += 1;
      logEvent({ level: "error", event: "background_job.failed", data: { jobId: job.id, type: job.type, attempts: job.attempts }, error });
      await markFailed(job, error);
    }
  }

  return summary;
}
