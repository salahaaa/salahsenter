export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, storeMedia, stores } from "@/lib/db";
import { storeMediaSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import { isStoreOperational } from "@/lib/store-guards";
import { Permission, userHasStorePermission } from "@/lib/rbac";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const payload = storeMediaSchema.parse(await request.json());

    if (!hasStoreAccess(session, payload.storeId)) return fail("لا تملك صلاحية تحديث وسائط هذا المتجر", 403);

    const [before] = await db.select().from(stores).where(eq(stores.id, payload.storeId)).limit(1);
    const [store] = await db
      .update(stores)
      .set({
        coverImageUrl: payload.coverImageUrl || null,
        logoUrl: payload.logoUrl || null,
        introImageUrl: payload.introImageUrl || null,
        videoUrl: payload.videoUrl || null,
        updatedAt: new Date()
      })
      .where(eq(stores.id, payload.storeId))
      .returning();

    await db.delete(storeMedia).where(and(eq(storeMedia.storeId, payload.storeId), eq(storeMedia.mediaType, "gallery")));
    if (payload.gallery.length) {
      await db.insert(storeMedia).values(
        payload.gallery.map((url, index) => ({
          storeId: payload.storeId,
          mediaType: "gallery" as const,
          url,
          sortOrder: index
        }))
      );
    }

    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "store_media", entityId: payload.storeId, beforeData: before, afterData: store });
    await invalidatePublicCache({
      tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.stores, PUBLIC_CACHE_TAGS.storeSlug(store.slug)],
      paths: ["/", `/store/${store.slug}`]
    });
    return ok({ store, message: "تم تحديث وسائط المتجر بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث وسائط المتجر");
  }
}
