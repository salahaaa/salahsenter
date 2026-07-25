export const dynamic = "force-dynamic";

import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, storeOfferCollections } from "@/lib/db";
import { eq } from "drizzle-orm";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";
import { dissolveStoreOfferBundle } from "@/lib/offers/bundle-dissolution";
import { dissolveOfferInventoryProduct } from "@/lib/offers/offer-product-inventory";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

const schema = z.object({ mode: z.enum(["full", "partial"]).default("full"), quantity: z.coerce.number().int().positive().optional(), note: z.string().optional(), idempotencyKey: z.string().min(8).max(180).optional() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = schema.parse(await request.json().catch(() => ({})));
    const [offer] = await db.select({ storeId: storeOfferCollections.storeId, offerProductId: storeOfferCollections.offerProductId }).from(storeOfferCollections).where(eq(storeOfferCollections.id, id)).limit(1);
    if (!offer) return fail("العرض غير موجود", 404);
    if (!hasStoreAccess(session, offer.storeId)) return fail("لا تملك صلاحية هذا العرض", 403);
    if (!(await userHasAnyStorePermission(session.userId, offer.storeId, [Permission.ManageStoreOffers, Permission.ManageInventory, Permission.ManageAnnouncements]))) return fail("لا تملك صلاحية تفكيك العرض", 403);

    const result = offer.offerProductId
      ? await dissolveOfferInventoryProduct({ offerId: id, actorId: session.userId, mode: payload.mode, quantity: payload.quantity, note: payload.note, idempotencyKey: payload.idempotencyKey, expectedStoreId: offer.storeId }, db)
      : await dissolveStoreOfferBundle({ offerId: id, actorId: session.userId, mode: payload.mode, quantity: payload.quantity, note: payload.note, idempotencyKey: payload.idempotencyKey, expectedStoreId: offer.storeId });
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "store_offer_bundle_dissolve", entityId: id, afterData: result });
    await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.offers], paths: ["/", "/offers", `/offers/${id}`] });
    return ok({ ...result, message: result.replay ? "تم تجاهل الطلب المكرر؛ العملية منفذة مسبقاً" : "تم تفكيك العرض وإعادة المخزون بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر تفكيك العرض وإعادة المخزون");
  }
}
