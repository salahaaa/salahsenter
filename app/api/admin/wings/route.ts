export const dynamic = "force-dynamic";

import { asc } from "drizzle-orm";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, wings } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { inlineMediaFlagSql, nonInlineMediaSql } from "@/lib/inline-media";
import { wingSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";
import { apiCacheKey, cacheHeader, getCachedPrivateApi, invalidatePrivateApiCacheTags } from "@/lib/cache/private-api-cache";
import { isAvailableActivityTemplateKey } from "@/lib/merchant/activity-template-selection";

const ADMIN_WINGS_CACHE_TAG = "admin:wings";

async function revalidatePublicPages(slug?: string) {
  revalidatePath("/smart-map");
  await invalidatePublicCache({
    tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.wings, ...(slug ? [PUBLIC_CACHE_TAGS.wingSlug(slug)] : [])],
    paths: ["/", "/wings", ...(slug ? [`/wings/${slug}`] : [])]
  });
}

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "wings.manage");
    const cached = await getCachedPrivateApi(
      apiCacheKey(["admin:wings", session.userId]),
      async () => {
        // Targeted select + strip base64 images at the SQL layer (they never leave the DB as base64).
        // Inline images are replaced with a short /api/media/inline proxy URL so they still render.
        const items = await db
          .select({
            id: wings.id,
            name: wings.name,
            slug: wings.slug,
            iconUrl: nonInlineMediaSql(wings.iconUrl),
            hasInlineIconImage: inlineMediaFlagSql(wings.iconUrl),
            heroImageUrl: nonInlineMediaSql(wings.heroImageUrl),
            hasInlineHeroImage: inlineMediaFlagSql(wings.heroImageUrl),
            mobileImageUrl: nonInlineMediaSql(wings.mobileImageUrl),
            hasInlineMobileImage: inlineMediaFlagSql(wings.mobileImageUrl),
            desktopImageUrl: nonInlineMediaSql(wings.desktopImageUrl),
            hasInlineDesktopImage: inlineMediaFlagSql(wings.desktopImageUrl),
            description: wings.description,
            activityTemplateKey: wings.activityTemplateKey,
            isActive: wings.isActive,
            sortOrder: wings.sortOrder
          })
          .from(wings)
          .orderBy(asc(wings.sortOrder), asc(wings.name));
        return { wings: items };
      },
      { ttlSeconds: 45, tags: [ADMIN_WINGS_CACHE_TAG], encrypted: true }
    );
    const response = ok(cached.value);
    response.headers.set("x-redis-cache", cacheHeader(cached.hit));
    return response;
  } catch (error) {
    return handleApiError(error, "تعذر تحميل الأجنحة");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "wings.manage");
    const payload = wingSchema.parse(await request.json());
    if (payload.activityTemplateKey && !(await isAvailableActivityTemplateKey(payload.activityTemplateKey))) return fail("قالب تجهيز الجناح غير متاح أو معطل حالياً.", 422);

    const [wing] = await db
      .insert(wings)
      .values({
        ...payload,
        slug: payload.slug || slugify(payload.name),
        iconUrl: payload.iconUrl || null,
        heroImageUrl: payload.heroImageUrl || null,
        mobileImageUrl: payload.mobileImageUrl || null,
        desktopImageUrl: payload.desktopImageUrl || null,
        isActive: payload.isActive ?? true,
        sortOrder: payload.sortOrder ?? 0
      })
      .returning();

    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "wing", entityId: wing.id, afterData: wing });
    await invalidatePrivateApiCacheTags([ADMIN_WINGS_CACHE_TAG]);
    await revalidatePublicPages(wing.slug);
    return created({ wing, message: "تم إنشاء الجناح بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء الجناح");
  }
}
