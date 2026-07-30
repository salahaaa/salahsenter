export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, wings } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { wingSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";
import { invalidatePrivateApiCacheTags } from "@/lib/cache/private-api-cache";
import { isAvailableActivityTemplateKey } from "@/lib/merchant/activity-template-selection";

const ADMIN_WINGS_CACHE_TAG = "admin:wings";

async function revalidatePublicPages(...slugs: Array<string | undefined>) {
  revalidatePath("/smart-map");
  const cleanSlugs = [...new Set(slugs.filter(Boolean) as string[])];
  await invalidatePublicCache({
    tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.wings, ...cleanSlugs.map((slug) => PUBLIC_CACHE_TAGS.wingSlug(slug))],
    paths: ["/", "/wings", ...cleanSlugs.map((slug) => `/wings/${slug}`)]
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await requireAuth();
    await assertAdmin(session, "wings.manage");
    const payload = wingSchema.partial().parse(await request.json());
    if (payload.activityTemplateKey && !(await isAvailableActivityTemplateKey(payload.activityTemplateKey))) return fail("قالب تجهيز الجناح غير متاح أو معطل حالياً.", 422);
    const [before] = await db.select().from(wings).where(eq(wings.id, params.id)).limit(1);
    if (!before) return fail("الجناح غير موجود", 404);
    const [wing] = await db.update(wings).set({ ...payload, slug: payload.slug || (payload.name ? slugify(payload.name) : before.slug), updatedAt: new Date() }).where(eq(wings.id, params.id)).returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "wing", entityId: wing.id, beforeData: before, afterData: wing });
    await invalidatePrivateApiCacheTags([ADMIN_WINGS_CACHE_TAG]);
    await revalidatePublicPages(before.slug, wing.slug);
    return ok({ wing, message: "تم تعديل الجناح بنجاح" });
  } catch (error) { return handleApiError(error, "تعذر تعديل الجناح"); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try { const session = await requireAuth(); await assertAdmin(session, "wings.manage"); const [before] = await db.select().from(wings).where(eq(wings.id, params.id)).limit(1); if (!before) return fail("الجناح غير موجود", 404); const [wing] = await db.update(wings).set({ isActive: false, updatedAt: new Date() }).where(eq(wings.id, params.id)).returning(); await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "wing", entityId: params.id, beforeData: before, afterData: wing }); await invalidatePrivateApiCacheTags([ADMIN_WINGS_CACHE_TAG]); await revalidatePublicPages(before.slug);
    return ok({ message: "تم تعطيل الجناح بنجاح" }); } catch (error) { return handleApiError(error, "تعذر حذف الجناح لوجود بيانات مرتبطة به"); }
}
