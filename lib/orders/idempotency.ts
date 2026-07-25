import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { idempotencyKeys } from "@/lib/db";

type DbLike = any;

export type IdempotencyReplay<T = Record<string, unknown>> = {
  replay: true;
  responseBody: T;
  statusCode: number;
};

export type IdempotencyStarted = {
  replay: false;
  key: string;
};

export type IdempotencyBeginResult<T = Record<string, unknown>> = IdempotencyReplay<T> | IdempotencyStarted;

export class IdempotencyConflictError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 409) {
    super(message);
    this.name = "IdempotencyConflictError";
    this.statusCode = statusCode;
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
}

export function hashRequestPayload(payload: unknown) {
  return crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function getRequestIdempotencyKey(request: Request) {
  return (request.headers.get("idempotency-key") || request.headers.get("x-idempotency-key") || "").trim();
}

export async function beginIdempotentRequest<T = Record<string, unknown>>(
  tx: DbLike,
  input: {
    scope: string;
    key: string;
    userId: string;
    requestHash: string;
    ttlMs?: number;
    lockMs?: number;
  }
): Promise<IdempotencyBeginResult<T>> {
  const key = input.key.trim();
  if (!key) return { replay: false, key };
  if (key.length > 180) throw new IdempotencyConflictError("مفتاح منع التكرار طويل جداً", 422);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + (input.ttlMs ?? 24 * 60 * 60 * 1000));
  const lockedUntil = new Date(now.getTime() + (input.lockMs ?? 2 * 60 * 1000));

  const [created] = await tx
    .insert(idempotencyKeys)
    .values({
      scope: input.scope,
      key,
      userId: input.userId,
      requestHash: input.requestHash,
      status: "processing",
      lockedUntil,
      expiresAt
    })
    .onConflictDoNothing()
    .returning({ id: idempotencyKeys.id });

  if (created) return { replay: false, key };

  const [existing] = await tx
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.scope, input.scope), eq(idempotencyKeys.key, key)))
    .limit(1);

  if (!existing) return { replay: false, key };
  if (existing.userId && existing.userId !== input.userId) {
    throw new IdempotencyConflictError("مفتاح منع التكرار مستخدم لحساب آخر", 403);
  }
  if (existing.requestHash !== input.requestHash) {
    throw new IdempotencyConflictError("لا يمكن إعادة استخدام مفتاح منع التكرار مع بيانات مختلفة", 409);
  }
  if (existing.status === "completed" && existing.responseBody) {
    return { replay: true, responseBody: existing.responseBody as T, statusCode: existing.statusCode || 200 };
  }
  if (existing.status === "processing" && existing.lockedUntil && new Date(existing.lockedUntil).getTime() > now.getTime()) {
    throw new IdempotencyConflictError("طلب مطابق قيد المعالجة حالياً، انتظر قليلاً قبل إعادة المحاولة", 409);
  }

  await tx
    .update(idempotencyKeys)
    .set({ status: "processing", lockedUntil, expiresAt, updatedAt: now })
    .where(and(eq(idempotencyKeys.scope, input.scope), eq(idempotencyKeys.key, key)));

  return { replay: false, key };
}

export async function completeIdempotentRequest(
  tx: DbLike,
  input: {
    scope: string;
    key: string;
    responseBody: Record<string, unknown>;
    statusCode?: number;
  }
) {
  if (!input.key) return;
  await tx
    .update(idempotencyKeys)
    .set({
      status: "completed",
      responseBody: input.responseBody,
      statusCode: input.statusCode || 200,
      lockedUntil: null,
      updatedAt: new Date()
    })
    .where(and(eq(idempotencyKeys.scope, input.scope), eq(idempotencyKeys.key, input.key)));
}
