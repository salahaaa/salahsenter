export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, products, stores } from "@/lib/db";
import { userHasStoreOperation } from "@/lib/rbac";
import { isStoreOperational } from "@/lib/store-guards";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePrivateApiCacheTags } from "@/lib/cache/private-api-cache";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

function merchantProductsCacheTag(storeId: string) { return `merchant:products:${storeId}`; }

const schema = z.object({
  showcaseStatus: z.enum(["AVAILABLE", "SOLD", "HIDDEN"]),
  showcaseSoldAt: z.string().datetime().optional().nullable(),
  showcaseNote: z.string().max(500).optional().nullable()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) return fail("المنتج غير موجود", 404);
    if (!hasStoreAccess(session, product.storeId)) return fail("لا تملك صلاحية هذا المنتج", 403);
    if (!(await userHasStoreOperation(session.userId, product.storeId, "products.showcase"))) return fail("لا تملك صلاحية إدارة المنتجات", 403);
    if (!(await isStoreOperational(product.storeId))) return fail("المتجر غير جاهز لتعديل المنتجات", 403);

    const soldAt = payload.showcaseStatus === "SOLD"
      ? payload.showcaseSoldAt ? new Date(payload.showcaseSoldAt) : new Date()
      : null;
    const [updated] = await db.update(products).set({
      showcaseStatus: payload.showcaseStatus,
      showcaseSoldAt: soldAt,
      showcaseNote: payload.showcaseStatus === "SOLD" ? payload.showcaseNote || "تم بيع هذه القطعة مؤخراً" : null,
      updatedAt: new Date()
    }).where(eq(products.id, id)).returning();

    const [store] = await db.select({ slug: stores.slug }).from(stores).where(eq(stores.id, product.storeId)).limit(1);
    await invalidatePrivateApiCacheTags([merchantProductsCacheTag(product.storeId)]);
    await invalidatePublicCache({
      tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.products, ...(store?.slug ? [PUBLIC_CACHE_TAGS.storeSlug(store.slug), PUBLIC_CACHE_TAGS.productSlug(store.slug, product.slug)] : [])],
      paths: ["/", ...(store?.slug ? [`/store/${store.slug}`, `/store/${store.slug}/products/${product.slug}`] : [])]
    });
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "product_showcase_status", entityId: id, beforeData: { showcaseStatus: product.showcaseStatus, showcaseSoldAt: product.showcaseSoldAt }, afterData: updated });
    return ok({ product: updated, message: "تم تحديث حالة عرض المنتج" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث حالة عرض المنتج");
  }
}
