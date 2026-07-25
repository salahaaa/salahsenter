export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, reviewReplies, reviews } from "@/lib/db";
import { userHasAnyStorePermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ body: z.string().trim().min(2).max(2_000), isVisible: z.boolean().default(true) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const session = await requireAuth(); const payload = schema.parse(await request.json());
    const [review] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
    if (!review?.storeId) return fail("التقييم غير موجود أو غير مرتبط بمتجر", 404);
    if (!hasStoreAccess(session, review.storeId) || !(await userHasAnyStorePermission(session.userId, review.storeId, ["store.customers.edit", "store.orders.view", "store_settings.manage"]))) return fail("لا تملك صلاحية الرد على التقييمات", 403);
    const [existing] = await db.select().from(reviewReplies).where(eq(reviewReplies.reviewId, id)).limit(1);
    const [reply] = existing
      ? await db.update(reviewReplies).set({ body: payload.body, isVisible: payload.isVisible, userId: session.userId, updatedAt: new Date() }).where(and(eq(reviewReplies.id, existing.id), eq(reviewReplies.storeId, review.storeId))).returning()
      : await db.insert(reviewReplies).values({ reviewId: id, storeId: review.storeId, userId: session.userId, body: payload.body, isVisible: payload.isVisible }).returning();
    await writeAuditLog({ actorId: session.userId, action: existing ? "update" : "create", entityType: "review_reply", entityId: reply.id, beforeData: existing || null, afterData: reply });
    return existing ? ok({ reply, message: "تم تحديث رد المتجر" }) : created({ reply, message: "تم نشر رد المتجر" });
  } catch (error) { return handleApiError(error, "تعذر حفظ رد المتجر"); }
}
