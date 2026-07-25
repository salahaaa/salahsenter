export const dynamic = "force-dynamic";

import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, mediaAssets, orderItems, orders, products, reviewMedia, reviewReplies, reviews, users } from "@/lib/db";

const postSchema = z.object({ productId: z.string().uuid().optional(), storeId: z.string().uuid().optional(), rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().min(3).max(4_000).optional(), mediaUrls: z.array(z.string().min(1)).max(6).default([]) });

export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const productId = url.searchParams.get("productId") || ""; const storeId = url.searchParams.get("storeId") || "";
    const conditions = [eq(reviews.isApproved, true), eq(reviews.moderationStatus, "approved")];
    if (productId) conditions.push(eq(reviews.productId, productId));
    if (storeId) conditions.push(eq(reviews.storeId, storeId));
    const items = await db.select({ id: reviews.id, rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt, userName: users.fullName }).from(reviews).innerJoin(users, eq(reviews.userId, users.id)).where(and(...conditions)).orderBy(desc(reviews.createdAt)).limit(50);
    const ids = items.map((item) => item.id);
    const [mediaRows, replyRows] = ids.length ? await Promise.all([
      db.select().from(reviewMedia).where(inArray(reviewMedia.reviewId, ids)).orderBy(reviewMedia.sortOrder),
      db.select({ reviewId: reviewReplies.reviewId, body: reviewReplies.body, createdAt: reviewReplies.createdAt }).from(reviewReplies).where(and(inArray(reviewReplies.reviewId, ids), eq(reviewReplies.isVisible, true)))
    ]) : [[], []];
    return ok({ reviews: items.map((item) => ({ ...item, media: mediaRows.filter((media) => media.reviewId === item.id), reply: replyRows.find((reply) => reply.reviewId === item.id) || null })) });
  } catch (error) { return handleApiError(error, "تعذر تحميل التقييمات"); }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(); const payload = postSchema.parse(await request.json());
    if (!payload.productId && !payload.storeId) return fail("يجب تحديد منتج أو متجر", 422);
    let storeId = payload.storeId || null;
    if (payload.productId) {
      const [product] = await db.select({ storeId: products.storeId }).from(products).where(eq(products.id, payload.productId)).limit(1);
      if (!product) return fail("المنتج غير موجود", 404);
      storeId = product.storeId;
      const deliveredOrders = await db.select({ orderId: orders.id }).from(orderItems).innerJoin(orders, eq(orderItems.orderId, orders.id)).where(and(eq(orderItems.productId, payload.productId), eq(orders.customerId, session.userId), inArray(orders.statusCode, ["delivered", "closed"]))).limit(1);
      if (!deliveredOrders.length) return fail("يمكن تقييم المنتج بعد الشراء والاستلام فقط", 403);
    }
    if (payload.mediaUrls.length) {
      const uploaded = await db.select({ url: mediaAssets.url }).from(mediaAssets).where(and(eq(mediaAssets.ownerId, session.userId), inArray(mediaAssets.url, payload.mediaUrls)));
      if (uploaded.length !== payload.mediaUrls.length) return fail("كل صور التقييم يجب أن تكون مرفوعة من حسابك", 422);
    }
    const [review] = await db.insert(reviews).values({ userId: session.userId, storeId, productId: payload.productId || null, rating: payload.rating, comment: payload.comment || null, isApproved: false, moderationStatus: "pending" }).returning();
    if (payload.mediaUrls.length) await db.insert(reviewMedia).values(payload.mediaUrls.map((url, index) => ({ reviewId: review.id, url, sortOrder: index })));
    return created({ review, message: "تم إرسال تقييمك للمراجعة قبل النشر" });
  } catch (error) { return handleApiError(error, "تعذر إرسال التقييم"); }
}
