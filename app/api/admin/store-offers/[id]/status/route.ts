export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, notifications, products, storeOfferCollections, stores } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";
import { dissolveOfferInventoryProductWithin } from "@/lib/offers/offer-product-inventory";

const schema = z.object({
  action: z.enum(["approve_homepage", "reject_homepage", "pause"]).optional(),
  /** Legacy status input remains only for migration-compatible admin clients. */
  status: z.enum(["pending_review", "approved", "rejected", "disabled"]).optional(),
  adminNote: z.string().trim().max(2_000).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  visibilitySchedule: z.record(z.unknown()).optional()
});

async function invalidateOffer(offerId: string, storeSlug?: string | null) {
  revalidatePath("/");
  await invalidatePublicCache({
    tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.offers, ...(storeSlug ? [PUBLIC_CACHE_TAGS.storeSlug(storeSlug)] : [])],
    paths: ["/", "/offers", `/offers/${offerId}`, ...(storeSlug ? [`/store/${storeSlug}`] : [])]
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "offers.manage");
    const payload = schema.parse(await request.json());
    const [before] = await db.select().from(storeOfferCollections).where(eq(storeOfferCollections.id, id)).limit(1);
    if (!before) return fail("العرض غير موجود", 404);
    const action = payload.action || (payload.status === "approved" ? "approve_homepage" : payload.status === "rejected" ? "reject_homepage" : payload.status === "disabled" ? "pause" : null);
    if (action === "reject_homepage" && !payload.adminNote) return fail("سبب الرفض مطلوب حتى يعرف التاجر ما الذي يحتاج إلى تعديله.", 422);

    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const [offer] = await tx.select().from(storeOfferCollections).where(eq(storeOfferCollections.id, id)).limit(1);
      if (!offer) throw new Error("العرض غير موجود");
      if (!action) {
        const [updated] = await tx.update(storeOfferCollections).set({
          startsAt: payload.startsAt === undefined ? offer.startsAt : payload.startsAt ? new Date(payload.startsAt) : null,
          endsAt: payload.endsAt === undefined ? offer.endsAt : payload.endsAt ? new Date(payload.endsAt) : null,
          visibilitySchedule: payload.visibilitySchedule ?? offer.visibilitySchedule,
          adminNote: payload.adminNote ?? offer.adminNote,
          reviewedBy: session.userId,
          reviewedAt: now,
          updatedAt: now
        }).where(eq(storeOfferCollections.id, id)).returning();
        return { offer: updated, message: "تم حفظ جدولة العرض دون تغيير حالة النشر." };
      }
      if (action === "approve_homepage") {
        if (offer.publicationTarget === "homepage" && offer.publicationState !== "homepage_review") throw new Error("لا يمكن اعتماد عرض الرئيسية إلا وهو في انتظار المراجعة.");
        const [updated] = await tx.update(storeOfferCollections).set({
          status: "approved",
          publicationTarget: "homepage",
          publicationState: "homepage_approved",
          homepageApprovedAt: now,
          adminNote: payload.adminNote || null,
          startsAt: payload.startsAt === undefined ? offer.startsAt : payload.startsAt ? new Date(payload.startsAt) : null,
          endsAt: payload.endsAt === undefined ? offer.endsAt : payload.endsAt ? new Date(payload.endsAt) : null,
          visibilitySchedule: payload.visibilitySchedule ?? offer.visibilitySchedule,
          reviewedBy: session.userId,
          reviewedAt: now,
          updatedAt: now
        }).where(eq(storeOfferCollections.id, id)).returning();
        if (offer.offerProductId) await tx.update(products).set({ status: "active", publishAt: updated.startsAt, unpublishAt: updated.endsAt, updatedAt: now }).where(eq(products.id, offer.offerProductId));
        return { offer: updated, message: "تم اعتماد العرض للنشر في الرئيسية ومنصة العروض." };
      }

      if (action === "reject_homepage") {
        let dissolution: unknown = null;
        if (offer.offerProductId) dissolution = await dissolveOfferInventoryProductWithin(tx, { offerId: id, actorId: session.userId, mode: "full", note: `Admin rejected: ${payload.adminNote}` });
        const [updated] = await tx.update(storeOfferCollections).set({
          status: "rejected",
          publicationState: "rejected",
          adminNote: payload.adminNote || null,
          reviewedBy: session.userId,
          reviewedAt: now,
          updatedAt: now
        }).where(eq(storeOfferCollections.id, id)).returning();
        if (offer.offerProductId) await tx.update(products).set({ status: "paused", updatedAt: now }).where(eq(products.id, offer.offerProductId));
        return { offer: updated, dissolution, message: "تم رفض العرض وإعادة وحداته غير المباعة إلى مخزون المكونات." };
      }

      const [updated] = await tx.update(storeOfferCollections).set({
        status: "disabled",
        publicationState: "paused",
        adminNote: payload.adminNote ?? offer.adminNote,
        startsAt: payload.startsAt === undefined ? offer.startsAt : payload.startsAt ? new Date(payload.startsAt) : null,
        endsAt: payload.endsAt === undefined ? offer.endsAt : payload.endsAt ? new Date(payload.endsAt) : null,
        visibilitySchedule: payload.visibilitySchedule ?? offer.visibilitySchedule,
        reviewedBy: session.userId,
        reviewedAt: now,
        updatedAt: now
      }).where(eq(storeOfferCollections.id, id)).returning();
      if (offer.offerProductId) await tx.update(products).set({ status: "paused", updatedAt: now }).where(eq(products.id, offer.offerProductId));
      return { offer: updated, message: "تم إيقاف العرض." };
    });

    const [store] = await db.select({ merchantId: stores.merchantId, slug: stores.slug }).from(stores).where(eq(stores.id, result.offer.storeId)).limit(1);
    await db.insert(notifications).values({ userId: store?.merchantId || null, storeId: result.offer.storeId, title: "تم تحديث حالة عرض المتجر", body: result.message, type: "store_offer_status_updated", data: { offerId: id, state: result.offer.publicationState, adminNote: payload.adminNote } });
    await writeAuditLog({ actorId: session.userId, action: action === "approve_homepage" ? "approve" : action === "reject_homepage" ? "reject" : "status_change", entityType: "store_offer_publication_review", entityId: id, beforeData: before, afterData: result });
    await invalidateOffer(id, store?.slug);
    return ok(result);
  } catch (error) {
    return handleApiError(error, "تعذر تحديث حالة العرض");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await requireAuth();
    await assertAdmin(session, "offers.manage");
    const [before] = await db.select().from(storeOfferCollections).where(eq(storeOfferCollections.id, params.id)).limit(1);
    if (!before) return fail("العرض غير موجود", 404);
    const [store] = await db.select({ slug: stores.slug }).from(stores).where(eq(stores.id, before.storeId)).limit(1);
    // Preserve audit/order references; a native offer product must be archived,
    // not hard-deleted out from under inventory history.
    await db.transaction(async (tx) => {
      if (before.offerProductId) {
        await dissolveOfferInventoryProductWithin(tx, { offerId: before.id, actorId: session.userId, mode: "full", note: "Admin archive offer" });
        await tx.update(products).set({ status: "archived", updatedAt: new Date() }).where(eq(products.id, before.offerProductId));
      }
      await tx.update(storeOfferCollections).set({ status: "disabled", publicationState: "paused", bundleInventoryStatus: "dissolved", updatedAt: new Date() }).where(eq(storeOfferCollections.id, before.id));
    });
    await writeAuditLog({ actorId: session.userId, action: "delete", category: "inventory", entityType: "store_offer_inventory_archive", entityId: params.id, beforeData: before });
    await invalidateOffer(params.id, store?.slug);
    return ok({ message: "تم تفكيك العرض وأرشفة منتجه المخزني." });
  } catch (error) {
    return handleApiError(error, "تعذر أرشفة العرض وإعادة مخزونه");
  }
}
