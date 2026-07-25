import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import { db, productLifecycleEvents, products, productVariants } from "@/lib/db";
import { calculateCatalogQuality } from "@/lib/products/catalog-quality";

type DbLike = any;
export type ProductLifecycleAction = "submit_review" | "pause" | "resume" | "archive" | "schedule_publish" | "schedule_pause";

function nextStatus(current: string, action: ProductLifecycleAction) {
  if (action === "submit_review") return "review";
  if (action === "pause") return "paused";
  if (action === "resume") return "active";
  if (action === "archive") return "archived";
  return current;
}

export async function getProductQuality(productId: string, tx: DbLike = db) {
  const [product, variants] = await Promise.all([
    tx.select().from(products).where(eq(products.id, productId)).limit(1).then((rows: any[]) => rows[0] || null),
    tx.select().from(productVariants).where(eq(productVariants.productId, productId))
  ]);
  if (!product) throw new Error("المنتج غير موجود");
  return calculateCatalogQuality({ ...product, variants });
}

export async function transitionProductLifecycle(input: { productId: string; storeId: string; actorId: string; action: ProductLifecycleAction; reason?: string | null; publishAt?: Date | null; unpublishAt?: Date | null; tx?: DbLike }) {
  const tx = input.tx || db;
  const [before] = await tx.select().from(products).where(and(eq(products.id, input.productId), eq(products.storeId, input.storeId))).limit(1);
  if (!before) throw new Error("المنتج غير موجود داخل المتجر");
  const quality = await getProductQuality(before.id, tx);
  const status = nextStatus(before.status, input.action);
  if (["submit_review", "resume"].includes(input.action) && !quality.ready) throw new Error(`جودة الكتالوج ${quality.score}% غير كافية للنشر/المراجعة. أكمل عناصر الجودة الأساسية أولاً.`);
  if (input.action === "schedule_publish" && (!input.publishAt || input.publishAt <= new Date())) throw new Error("حدد وقت نشر مستقبلي صالح");
  if (input.action === "schedule_pause" && (!input.unpublishAt || input.unpublishAt <= new Date())) throw new Error("حدد وقت إيقاف مستقبلي صالح");
  const [product] = await tx.update(products).set({
    status,
    publishAt: input.action === "schedule_publish" ? input.publishAt : input.action === "resume" ? null : before.publishAt,
    unpublishAt: input.action === "schedule_pause" ? input.unpublishAt : before.unpublishAt,
    reviewNote: input.reason || before.reviewNote,
    updatedAt: new Date()
  }).where(eq(products.id, before.id)).returning();
  const [event] = await tx.insert(productLifecycleEvents).values({ productId: before.id, storeId: before.storeId, fromStatus: before.status, toStatus: product.status, reason: input.reason || null, actorId: input.actorId, metadata: { action: input.action, qualityScore: quality.score, publishAt: product.publishAt, unpublishAt: product.unpublishAt } }).returning();
  return { before, product, event, quality };
}

export async function processProductPublicationSchedules(limit = 200) {
  const now = new Date();
  const scheduledPublish = await db.select().from(products).where(and(inArray(products.status, ["draft", "review", "paused"]), lte(products.publishAt, now))).limit(limit);
  const scheduledPause = await db.select().from(products).where(and(eq(products.status, "active"), lte(products.unpublishAt, now))).limit(limit);
  const changed = [];
  for (const product of scheduledPublish) {
    const quality = await getProductQuality(product.id);
    if (!quality.ready) continue;
    const [updated] = await db.update(products).set({ status: "active", publishAt: null, updatedAt: now }).where(eq(products.id, product.id)).returning();
    await db.insert(productLifecycleEvents).values({ productId: product.id, storeId: product.storeId, fromStatus: product.status, toStatus: "active", reason: "جدولة نشر تلقائية", metadata: { qualityScore: quality.score }, actorId: null });
    changed.push(updated);
  }
  for (const product of scheduledPause) {
    const [updated] = await db.update(products).set({ status: "paused", unpublishAt: null, updatedAt: now }).where(eq(products.id, product.id)).returning();
    await db.insert(productLifecycleEvents).values({ productId: product.id, storeId: product.storeId, fromStatus: "active", toStatus: "paused", reason: "جدولة إيقاف تلقائية", metadata: {}, actorId: null });
    changed.push(updated);
  }
  return { published: scheduledPublish.length, paused: scheduledPause.length, changed };
}
