import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, inventoryMovements, productVariants, storeOfferBundleOperations, storeOfferCollections, storeOfferItems } from "@/lib/db";
import { calculateBundleRestoration, normalizeBundleQuantity } from "@/lib/offers/bundle-calculations";

type DbLike = any;

type DissolveInput = {
  offerId: string;
  actorId: string;
  quantity?: number | null;
  mode?: "full" | "partial";
  note?: string | null;
  idempotencyKey?: string | null;
  expectedStoreId?: string | null;
};

export async function dissolveStoreOfferBundle(input: DissolveInput, txOrDb: DbLike = db) {
  return txOrDb.transaction(async (tx: DbLike) => {
    if (input.idempotencyKey) {
      const [existing] = await tx.select().from(storeOfferBundleOperations).where(eq(storeOfferBundleOperations.idempotencyKey, input.idempotencyKey)).limit(1);
      if (existing) return { operation: existing, replay: true };
    }

    await tx.execute(sql`select id from store_offer_collections where id = ${input.offerId} for update`);
    const [offer] = await tx.select().from(storeOfferCollections).where(eq(storeOfferCollections.id, input.offerId)).limit(1);
    if (!offer) throw new Error("العرض غير موجود");
    if (input.expectedStoreId && offer.storeId !== input.expectedStoreId) throw new Error("لا تملك صلاحية تفكيك هذا العرض");

    const beforeRemaining = Number(offer.bundleRemainingQuantity || 0);
    if (beforeRemaining <= 0) throw new Error("لا توجد كمية متبقية قابلة للتفكيك في هذا العرض");
    const requestedQuantity = input.mode === "full" || !input.quantity ? beforeRemaining : normalizeBundleQuantity(input.quantity, 0);
    if (requestedQuantity <= 0) throw new Error("كمية التفكيك غير صحيحة");
    if (requestedQuantity > beforeRemaining) throw new Error("لا يمكن تفكيك كمية أكبر من المتوفر في العرض");

    const items = await tx.select().from(storeOfferItems).where(eq(storeOfferItems.offerId, input.offerId));
    if (!items.length) throw new Error("لا توجد أصناف داخل العرض لتفكيكها");
    if (items.some((item: typeof storeOfferItems.$inferSelect) => !item.variantId)) throw new Error("بعض أصناف العرض غير مرتبطة بمتغير مخزون صحيح");

    const opId = crypto.randomUUID();
    const restored = [];
    for (const calc of calculateBundleRestoration(items.map((item: typeof storeOfferItems.$inferSelect) => ({ productId: item.productId, variantId: item.variantId, title: item.title, quantity: item.quantity, originalPrice: item.originalPrice, offerPrice: item.offerPrice })), requestedQuantity)) {
      if (!calc.variantId) throw new Error("متغير مخزون غير موجود");
      const [updatedVariant] = await tx
        .update(productVariants)
        .set({ stockQuantity: sql`${productVariants.stockQuantity} + ${calc.restoreQuantity}`, updatedAt: new Date() })
        .where(eq(productVariants.id, calc.variantId))
        .returning({ id: productVariants.id, stockQuantity: productVariants.stockQuantity });
      if (!updatedVariant) throw new Error(`تعذر إعادة مخزون ${calc.title || calc.variantId}`);
      const afterQuantity = Number(updatedVariant.stockQuantity || 0);
      const beforeQuantity = afterQuantity - calc.restoreQuantity;
      await tx.insert(inventoryMovements).values({
        storeId: offer.storeId,
        productId: calc.productId,
        variantId: calc.variantId,
        type: "release",
        quantity: calc.restoreQuantity,
        beforeQuantity,
        afterQuantity,
        reason: `Bundle dissolve ${offer.title} x${requestedQuantity}`,
        referenceType: "store_offer_bundle_dissolve",
        referenceId: opId,
        actorId: input.actorId
      });
      restored.push({ ...calc, beforeQuantity, afterQuantity });
    }

    const afterRemaining = beforeRemaining - requestedQuantity;
    const [updatedOffer] = await tx
      .update(storeOfferCollections)
      .set({
        bundleRemainingQuantity: afterRemaining,
        bundleDissolvedQuantity: sql`${storeOfferCollections.bundleDissolvedQuantity} + ${requestedQuantity}`,
        bundleInventoryStatus: afterRemaining === 0 ? "dissolved" : "active",
        status: afterRemaining === 0 ? "disabled" : offer.status,
        updatedAt: new Date()
      })
      .where(eq(storeOfferCollections.id, offer.id))
      .returning();

    const [operation] = await tx.insert(storeOfferBundleOperations).values({
      id: opId,
      offerId: offer.id,
      storeId: offer.storeId,
      actorId: input.actorId,
      operationType: "dissolve",
      quantity: requestedQuantity,
      beforeRemaining,
      afterRemaining,
      itemsSnapshot: restored,
      note: input.note || null,
      idempotencyKey: input.idempotencyKey || null
    }).returning();

    return { operation, offer: updatedOffer, restored, replay: false };
  });
}

export async function getBundleOperationsForOffer(offerId: string) {
  return db.select().from(storeOfferBundleOperations).where(and(eq(storeOfferBundleOperations.offerId, offerId), eq(storeOfferBundleOperations.operationType, "dissolve"))).orderBy(sql`${storeOfferBundleOperations.createdAt} desc`).limit(20);
}
