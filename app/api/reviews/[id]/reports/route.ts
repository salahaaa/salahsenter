export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, reviewReports, reviews } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ reason: z.enum(["spam", "abuse", "fake", "privacy", "other"]), detail: z.string().trim().max(1_000).optional().nullable() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const session = await requireAuth(); const payload = schema.parse(await request.json());
    const [review] = await db.select({ id: reviews.id, userId: reviews.userId }).from(reviews).where(eq(reviews.id, id)).limit(1);
    if (!review) return fail("التقييم غير موجود", 404);
    if (review.userId === session.userId) return fail("لا يمكن الإبلاغ عن تقييمك الخاص", 409);
    const [report] = await db.insert(reviewReports).values({ reviewId: id, reporterId: session.userId, reason: payload.reason, detail: payload.detail || null }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "review_report", entityId: report.id, afterData: report });
    return created({ report, message: "تم إرسال البلاغ للمراجعة" });
  } catch (error) { return handleApiError(error, "تعذر إرسال بلاغ التقييم"); }
}
