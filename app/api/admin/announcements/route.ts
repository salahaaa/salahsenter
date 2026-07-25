export const dynamic = "force-dynamic";

import { and, desc, eq } from "drizzle-orm";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { announcements, db } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { assertAdminOperation } from "@/lib/rbac";
import { announcementSchema } from "@/lib/validators";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

async function revalidatePublicPages() {
  await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home], paths: ["/"] });
}

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "ads.view");
    const items = await db
      .select()
      .from(announcements)
      .where(eq(announcements.level, "marketplace"))
      .orderBy(desc(announcements.createdAt))
      .limit(100);
    return ok({ announcements: items });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل إعلانات المول");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "ads.create");
    const payload = announcementSchema.parse(await request.json());

    const [announcement] = await db
      .insert(announcements)
      .values({
        level: "marketplace",
        storeId: null,
        title: payload.title,
        summary: payload.summary,
        body: payload.body,
        imageUrl: payload.imageUrl || null,
        linkUrl: payload.linkUrl || null,
        isPinned: payload.isPinned,
        startAt: payload.startAt ? new Date(payload.startAt) : null,
        endAt: payload.endAt ? new Date(payload.endAt) : null,
        status: payload.status,
        visibilitySchedule: payload.visibilitySchedule,
        isPromoted: payload.isPromoted,
        promotionStart: payload.promotionStart ? new Date(payload.promotionStart) : null,
        promotionEnd: payload.promotionEnd ? new Date(payload.promotionEnd) : null,
        promotionPackage: payload.promotionPackage,
        createdBy: session.userId
      })
      .returning();

    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "marketplace_announcement", entityId: announcement.id, afterData: announcement });
    await revalidatePublicPages();
    return created({ announcement, message: "تم حفظ إعلان المول بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ إعلان المول");
  }
}
