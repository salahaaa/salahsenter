export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, productVariants, products, storeOfferCollections } from "@/lib/db";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";
import { stores } from "@/lib/db";
import { dissolveOfferInventoryProductWithin } from "@/lib/offers/offer-product-inventory";

const actionSchema = z.object({
  action: z.enum(["pause", "resume_storefront", "request_homepage_review"]),
  note: z.string().trim().max(1_000).optional()
});

async function invalidateOffer(storeId: string, offerId: string) {
  const [store] = await db.select({ slug: stores.slug }).from(stores).where(eq(stores.id, storeId)).limit(1);
  await invalidatePublicCache({
    tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.offers, ...(store?.slug ? [PUBLIC_CACHE_TAGS.storeSlug(store.slug)] : [])],
    paths: ["/", "/offers", `/offers/${offerId}`, ...(store?.slug ? [`/store/${store.slug}`] : [])]
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = actionSchema.parse(await request.json());
    const [before] = await db.select().from(storeOfferCollections).where(eq(storeOfferCollections.id, id)).limit(1);
    if (!before) return fail("العرض غير موجود", 404);
    if (!hasStoreAccess(session, before.storeId)) return fail("لا تملك صلاحية تعديل هذا العرض", 403);
    if (!(await userHasAnyStorePermission(session.userId, before.storeId, [Permission.ManageStoreOffers, Permission.ManageInventory]))) return fail("لا تملك صلاحية عروض المتجر", 403);
    if (!before.offerProductId || !before.offerVariantId) return fail("العرض القديم لا يدعم أوامر دورة المنتج المخزني. راجع الإدارة أو أنشئ عرضاً جديداً.", 409);

    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const [offer] = await tx.select().from(storeOfferCollections).where(eq(storeOfferCollections.id, id)).limit(1);
      if (!offer) throw new Error("العرض غير موجود");
      const [variant] = await tx.select({ stockQuantity: productVariants.stockQuantity, reservedQuantity: productVariants.reservedQuantity }).from(productVariants).where(eq(productVariants.id, offer.offerVariantId!)).limit(1);
      const availableBundles = Math.max(0, Number(variant?.stockQuantity || 0) - Number(variant?.reservedQuantity || 0));

      if (payload.action === "pause") {
        const [updated] = await tx.update(storeOfferCollections).set({ publicationState: "paused", status: "disabled", adminNote: payload.note || offer.adminNote, updatedAt: now }).where(eq(storeOfferCollections.id, id)).returning();
        await tx.update(products).set({ status: "paused", updatedAt: now }).where(eq(products.id, offer.offerProductId!));
        return { offer: updated, message: "تم إيقاف العرض. يمكنك تفكيك وحداته المخزنية وإعادة المكونات عند انتهاء الحاجة إليه." };
      }

      if (!availableBundles) throw new Error("لا توجد وحدات عرض متاحة للنشر. فكك العرض أو أعد تجميعه بمخزون جديد.");
      if (payload.action === "resume_storefront") {
        if (offer.publicationTarget !== "storefront") throw new Error("هذا العرض مخصص للرئيسية/منصة العروض ولا يمكن نشره محلياً بهذه العملية.");
        if (offer.endsAt && offer.endsAt <= now) throw new Error("انتهت فترة العرض؛ فكك الوحدات أو أنشئ عرضاً جديداً بفترة جديدة.");
        const [updated] = await tx.update(storeOfferCollections).set({ publicationState: "storefront_live", status: "approved", storefrontPublishedAt: now, updatedAt: now }).where(eq(storeOfferCollections.id, id)).returning();
        await tx.update(products).set({ status: "active", publishAt: offer.startsAt, unpublishAt: offer.endsAt, updatedAt: now }).where(eq(products.id, offer.offerProductId!));
        return { offer: updated, message: "تمت إعادة نشر العرض داخل نافذة متجرِك فقط." };
      }

      // The merchant can request platform exposure, but never approve it.
      if (payload.action === "request_homepage_review") {
        if (offer.endsAt && offer.endsAt <= now) throw new Error("انتهت فترة العرض؛ لا يمكن طلب نشره في الرئيسية.");
        const [updated] = await tx.update(storeOfferCollections).set({ publicationTarget: "homepage", publicationState: "homepage_review", status: "pending_review", reviewRequestedAt: now, adminNote: null, updatedAt: now }).where(eq(storeOfferCollections.id, id)).returning();
        await tx.update(products).set({ status: "review", updatedAt: now }).where(eq(products.id, offer.offerProductId!));
        return { offer: updated, message: "تم إرسال طلب نشر العرض في الرئيسية ومنصة العروض إلى الإدارة. لن يظهر للعامة قبل الاعتماد." };
      }
      throw new Error("إجراء العرض غير مدعوم");
    });

    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "store_offer_publication_action", entityId: id, beforeData: before, afterData: { action: payload.action, offer: result.offer } });
    await invalidateOffer(before.storeId, id);
    return ok({ ...result });
  } catch (error) {
    return handleApiError(error, "تعذر تنفيذ إجراء العرض");
  }
}

/**
 * Archiving is deliberately a safe inventory operation, not a hard delete:
 * all currently available offer units are dismantled and source components are
 * returned before the native offer product is archived.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const [before] = await db.select().from(storeOfferCollections).where(eq(storeOfferCollections.id, id)).limit(1);
    if (!before) return fail("العرض غير موجود", 404);
    if (!hasStoreAccess(session, before.storeId)) return fail("لا تملك صلاحية حذف هذا العرض", 403);
    if (!(await userHasAnyStorePermission(session.userId, before.storeId, [Permission.ManageStoreOffers, Permission.ManageInventory]))) return fail("لا تملك صلاحية عروض المتجر", 403);
    if (!before.offerProductId) return fail("العرض القديم لا يمكن أرشفته بأمان قبل مراجعة مخزونه.", 409);

    const result = await db.transaction(async (tx) => {
      const dissolution = await dissolveOfferInventoryProductWithin(tx, { offerId: id, actorId: session.userId, mode: "full", note: "Merchant archive: dissolve available offer inventory" });
      await tx.update(products).set({ status: "archived", updatedAt: new Date() }).where(eq(products.id, before.offerProductId!));
      const [offer] = await tx.update(storeOfferCollections).set({ publicationState: "paused", status: "disabled", bundleInventoryStatus: "dissolved", updatedAt: new Date() }).where(eq(storeOfferCollections.id, id)).returning();
      return { offer, dissolution };
    });
    await writeAuditLog({ actorId: session.userId, action: "delete", category: "inventory", entityType: "store_offer_inventory_archive", entityId: id, beforeData: before, afterData: result });
    await invalidateOffer(before.storeId, id);
    return ok({ ...result, message: "تم تفكيك الوحدات المتاحة وإعادة المكونات إلى المخزون ثم أرشفة منتج العرض." });
  } catch (error) {
    return handleApiError(error, "تعذر أرشفة العرض وإعادة مخزونه");
  }
}
