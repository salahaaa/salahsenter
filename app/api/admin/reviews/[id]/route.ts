export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, reviewReports, reviews } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ moderationStatus: z.enum(["approved", "rejected", "hidden"]), moderationNote: z.string().trim().max(2_000).optional().nullable(), resolveReports: z.boolean().default(false) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const session = await requireAuth();
    await assertAdminOperation(session, "customers.edit");
    const payload = schema.parse(await request.json());
    const [before] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
    if (!before) return fail("التقييم غير موجود", 404);
    const [review] = await db.update(reviews).set({ moderationStatus: payload.moderationStatus, isApproved: payload.moderationStatus === "approved", moderatedBy: session.userId, moderatedAt: new Date(), moderationNote: payload.moderationNote || null, updatedAt: new Date() }).where(eq(reviews.id, id)).returning();
    if (payload.resolveReports) await db.update(reviewReports).set({ status: "resolved", resolvedBy: session.userId, resolvedAt: new Date(), resolutionNote: payload.moderationNote || null, updatedAt: new Date() }).where(eq(reviewReports.reviewId, id));
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "review_moderation", entityId: id, beforeData: before, afterData: review });
    return ok({ review, message: "تمت مراجعة التقييم" });
  } catch (error) { return handleApiError(error, "تعذر مراجعة التقييم"); }
}
