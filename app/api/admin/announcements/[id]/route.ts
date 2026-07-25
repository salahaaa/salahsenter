export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { announcements, db } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { announcementSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

async function revalidatePublicPages() {
  await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home], paths: ["/"] });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params; try { const session = await requireAuth(); await assertAdminOperation(session, "ads.edit"); const payload = announcementSchema.partial().parse(await request.json()); const [before] = await db.select().from(announcements).where(eq(announcements.id, params.id)).limit(1); if (!before) return fail("الإعلان غير موجود", 404); const [announcement] = await db.update(announcements).set({ ...payload, imageUrl: payload.imageUrl || undefined, linkUrl: payload.linkUrl || undefined, startAt: payload.startAt ? new Date(payload.startAt) : undefined, endAt: payload.endAt ? new Date(payload.endAt) : undefined, promotionStart: payload.promotionStart ? new Date(payload.promotionStart) : undefined, promotionEnd: payload.promotionEnd ? new Date(payload.promotionEnd) : undefined, updatedAt: new Date() }).where(eq(announcements.id, params.id)).returning(); await writeAuditLog({ actorId: session.userId, action: "update", entityType: "announcement", entityId: announcement.id, beforeData: before, afterData: announcement }); await revalidatePublicPages();
    return ok({ announcement, message: "تم تعديل الإعلان بنجاح" }); } catch (error) { return handleApiError(error, "تعذر تعديل الإعلان"); } }
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params; try { const session = await requireAuth(); await assertAdminOperation(session, "ads.delete"); const [before] = await db.select().from(announcements).where(eq(announcements.id, params.id)).limit(1); if (!before) return fail("الإعلان غير موجود", 404); const [item] = await db.update(announcements).set({ status: "disabled", updatedAt: new Date() }).where(eq(announcements.id, params.id)).returning(); await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "announcement", entityId: params.id, beforeData: before, afterData: item }); await revalidatePublicPages();
    return ok({ message: "تم حذف الإعلان بنجاح" }); } catch (error) { return handleApiError(error, "تعذر حذف الإعلان"); } }
