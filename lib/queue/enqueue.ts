import { backgroundJobs } from "@/lib/db";

type DbLike = any;

export type QueueJobType =
  | "notifications.order_created"
  | "notifications.order_status_updated"
  | "wallet.award_loyalty"
  | "analytics.product_view"
  | "outbound.message"
  | string;

export type EnqueueJobInput = {
  type: QueueJobType;
  payload: Record<string, unknown>;
  queue?: string;
  priority?: number;
  delayMs?: number;
  maxAttempts?: number;
  dedupeKey?: string;
};

export async function enqueueJob(dbOrTx: DbLike, input: EnqueueJobInput) {
  const availableAt = new Date(Date.now() + Math.max(0, input.delayMs || 0));
  const values = {
    queue: input.queue || "default",
    type: input.type,
    payload: input.payload,
    priority: input.priority || 0,
    maxAttempts: input.maxAttempts || 5,
    availableAt,
    dedupeKey: input.dedupeKey || null
  };

  const insert = dbOrTx.insert(backgroundJobs).values(values);
  const rows = input.dedupeKey
    ? await insert.onConflictDoNothing({ target: [backgroundJobs.queue, backgroundJobs.dedupeKey] }).returning()
    : await insert.returning();
  return rows[0] || null;
}

export async function enqueueJobs(dbOrTx: DbLike, jobs: EnqueueJobInput[]) {
  const result = [];
  for (const job of jobs) result.push(await enqueueJob(dbOrTx, job));
  return result;
}
