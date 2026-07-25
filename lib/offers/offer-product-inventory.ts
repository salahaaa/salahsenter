import crypto from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  categories,
  inventoryMovements,
  productVariants,
  products,
  storeOfferBundleOperations,
  storeOfferCollections,
  storeOfferItems,
  storeOfferOrderAllocations,
  units
} from "@/lib/db";
import { generateCategoryCode, generateProductCode } from "@/lib/product-coding";
import { slugify, uniqueSlug } from "@/lib/slug";
import { normalizeBundleQuantity } from "@/lib/offers/bundle-calculations";
import { assertRentalLimit, lockRentalEntitlement } from "@/lib/rentals/service";

type DbLike = any;

export type OfferComponentForAssembly = {
  productId: string;
  variantId: string;
  title: string;
  imageUrl?: string | null;
  quantity: number;
  originalUnitPrice: number;
  offerUnitPrice: number;
};

function money(value: number) {
  return Math.round((Math.max(0, value) + Number.EPSILON) * 100) / 100;
}

function totals(components: OfferComponentForAssembly[]) {
  return components.reduce((sum, item) => ({
    original: money(sum.original + item.originalUnitPrice * item.quantity),
    offer: money(sum.offer + item.offerUnitPrice * item.quantity),
    units: sum.units + item.quantity
  }), { original: 0, offer: 0, units: 0 });
}

async function ensureOfferCategory(tx: DbLike, storeId: string) {
  const [existing] = await tx.select().from(categories).where(and(eq(categories.storeId, storeId), eq(categories.name, "عروض المتجر"))).limit(1);
  if (existing) return existing;
  const code = await generateCategoryCode(tx, storeId, null);
  const [created] = await tx.insert(categories).values({
    storeId,
    name: "عروض المتجر",
    slug: slugify(`${code}-عروض-المتجر`),
    code,
    codeMode: "auto",
    isActive: true,
    sortOrder: 9990
  }).returning();
  return created;
}

/**
 * Converts component stock to a real, native product variant for the offer.
 * It is intentionally only called for platform-inventory (Standalone) stores;
 * ERP stores retain ERP as their inventory authority and must not be mutated.
 */
export async function assembleOfferInventoryProduct(input: {
  tx: DbLike;
  offerId: string;
  storeId: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  publishAt?: Date | null;
  unpublishAt?: Date | null;
  bundleQuantity: number;
  components: OfferComponentForAssembly[];
  /** Final price of one native offer product; may be a fixed bundle price. */
  offerProductPrice?: number;
  productStatus: "draft" | "review" | "active" | "paused";
  actorId: string;
}) {
  const { tx, bundleQuantity, components } = input;
  const bundles = normalizeBundleQuantity(bundleQuantity, 0);
  if (!bundles) throw new Error("حدد عدداً صحيحاً وموجباً لوحدات العرض المخزنية.");
  if (!components.length || components.some((component) => !component.variantId || component.quantity <= 0)) throw new Error("يجب أن يرتبط كل مكوّن في العرض بمتغير مخزون صالح.");

  const [defaultUnit] = await tx.select({ id: units.id }).from(units).where(and(eq(units.storeId, input.storeId), eq(units.isActive, true))).limit(1);
  if (!defaultUnit) throw new Error("أضف وحدة بيع نشطة واحدة على الأقل قبل تحويل العرض إلى منتج مخزني.");

  await lockRentalEntitlement(input.storeId, tx);
  const [{ count: currentProductCount }] = await tx.select({ count: sql<number>`count(*)::int` }).from(products).where(eq(products.storeId, input.storeId));
  await assertRentalLimit({ storeId: input.storeId, resource: "products", currentCount: currentProductCount, tx });

  const componentTotals = totals(components);
  const finalOfferPrice = money(input.offerProductPrice ?? componentTotals.offer);
  if (finalOfferPrice <= 0) throw new Error("سعر المنتج المخزني للعرض يجب أن يكون أكبر من صفر.");

  // Atomically remove components from their source variants before creating the
  // new offer stock. A transaction rollback leaves no half-assembled offer.
  for (const component of components) {
    const allocation = component.quantity * bundles;
    const [updated] = await tx
      .update(productVariants)
      .set({ stockQuantity: sql`${productVariants.stockQuantity} - ${allocation}`, updatedAt: new Date() })
      .where(and(eq(productVariants.id, component.variantId), sql`${productVariants.stockQuantity} - ${productVariants.reservedQuantity} >= ${allocation}`))
      .returning({ stockQuantity: productVariants.stockQuantity, reservedQuantity: productVariants.reservedQuantity });
    if (!updated) throw new Error(`المخزون غير كافٍ لتجميع ${bundles} وحدة من العرض: ${component.title}`);
    const afterQuantity = Number(updated.stockQuantity || 0);
    await tx.insert(inventoryMovements).values({
      storeId: input.storeId,
      productId: component.productId,
      variantId: component.variantId,
      type: "deduct",
      quantity: allocation,
      beforeQuantity: afterQuantity + allocation,
      afterQuantity,
      reason: `Offer assembly ${input.offerId}: ${bundles} bundle units allocated`,
      referenceType: "store_offer_assembly",
      referenceId: input.offerId,
      actorId: input.actorId
    });
  }

  const category = await ensureOfferCategory(tx, input.storeId);
  const productCode = await generateProductCode(tx, input.storeId, category.id);
  const shortOfferId = input.offerId.replace(/-/g, "").slice(0, 10).toUpperCase();
  const offerName = `عرض: ${input.title}`.slice(0, 180);
  const [offerProduct] = await tx.insert(products).values({
    storeId: input.storeId,
    categoryId: category.id,
    name: offerName,
    slug: uniqueSlug(`${input.title}-offer-${shortOfferId}`),
    productCode,
    codeMode: "auto",
    shortDescription: input.description || `منتج عرض مخزني يتكون من ${componentTotals.units} قطعة داخل الباقة.`,
    description: input.description || `باقة عرض مخزنية: ${components.map((component) => `${component.quantity} × ${component.title}`).join("، ")}`,
    type: "simple",
    status: input.productStatus,
    publishAt: input.publishAt || null,
    unpublishAt: input.unpublishAt || null,
    basePrice: finalOfferPrice.toString(),
    mainImageUrl: input.imageUrl || components.find((component) => component.imageUrl)?.imageUrl || null,
    images: input.imageUrl ? [input.imageUrl] : [],
    specifications: {
      offerCollectionId: input.offerId,
      inventoryKind: "assembled_offer_bundle",
      components: components.map((component) => ({ productId: component.productId, variantId: component.variantId, quantity: component.quantity, title: component.title }))
    },
    pricingMode: "independent",
    inventoryMode: "product",
    productCommerceType: "ONLINE_SALES",
    discountPercent: componentTotals.original > finalOfferPrice ? money((1 - finalOfferPrice / componentTotals.original) * 100).toString() : "0"
  }).returning();

  const [offerVariant] = await tx.insert(productVariants).values({
    productId: offerProduct.id,
    sku: `OFR-${shortOfferId}`,
    title: "وحدة عرض",
    unitId: defaultUnit.id,
    price: finalOfferPrice.toString(),
    compareAtPrice: componentTotals.original > finalOfferPrice ? componentTotals.original.toString() : null,
    stockQuantity: bundles,
    reservedQuantity: 0,
    lowStockThreshold: Math.min(5, bundles),
    imageUrl: offerProduct.mainImageUrl,
    images: offerProduct.images,
    attributes: { offerCollectionId: input.offerId, bundleUnits: String(componentTotals.units) },
    isActive: input.productStatus === "active"
  }).returning();

  await tx.insert(inventoryMovements).values({
    storeId: input.storeId,
    productId: offerProduct.id,
    variantId: offerVariant.id,
    type: "add",
    quantity: bundles,
    beforeQuantity: 0,
    afterQuantity: bundles,
    reason: `Offer assembly ${input.offerId}: native offer inventory product created`,
    referenceType: "store_offer_assembly",
    referenceId: input.offerId,
    actorId: input.actorId
  });

  return { offerProduct, offerVariant, totals: { ...componentTotals, offer: finalOfferPrice } };
}

export async function dissolveOfferInventoryProduct(input: {
  offerId: string;
  actorId: string;
  mode?: "full" | "partial";
  quantity?: number | null;
  note?: string | null;
  idempotencyKey?: string | null;
  expectedStoreId?: string | null;
}, txOrDb: DbLike) {
  return txOrDb.transaction(async (tx: DbLike) => dissolveOfferInventoryProductWithin(tx, input));
}

export async function dissolveOfferInventoryProductWithin(tx: DbLike, input: {
  offerId: string;
  actorId: string;
  mode?: "full" | "partial";
  quantity?: number | null;
  note?: string | null;
  idempotencyKey?: string | null;
  expectedStoreId?: string | null;
}) {
  if (input.idempotencyKey) {
    const [existing] = await tx.select().from(storeOfferBundleOperations).where(eq(storeOfferBundleOperations.idempotencyKey, input.idempotencyKey)).limit(1);
    if (existing) return { operation: existing, replay: true, offer: null, restored: [] as unknown[] };
  }

  await tx.execute(sql`select id from store_offer_collections where id = ${input.offerId} for update`);
  const [offer] = await tx.select().from(storeOfferCollections).where(eq(storeOfferCollections.id, input.offerId)).limit(1);
  if (!offer) throw new Error("العرض غير موجود");
  if (input.expectedStoreId && offer.storeId !== input.expectedStoreId) throw new Error("لا تملك صلاحية تفكيك هذا العرض");
  if (!offer.offerProductId || !offer.offerVariantId) throw new Error("هذا عرض قديم لا يملك منتجاً مخزنياً مولداً؛ استخدم مسار تفكيك العرض القديم بعد مراجعة المخزون.");

  const [offerVariant] = await tx.select().from(productVariants).where(eq(productVariants.id, offer.offerVariantId)).limit(1);
  if (!offerVariant) throw new Error("متغير المنتج المخزني للعرض غير موجود");
  const availableBundles = Math.max(0, Number(offerVariant.stockQuantity || 0) - Number(offerVariant.reservedQuantity || 0));
  if (!availableBundles) {
    if (input.mode === "full") return { operation: null, offer, restored: [] as unknown[], replay: false };
    throw new Error("لا توجد وحدات عرض غير محجوزة قابلة للتفكيك.");
  }
  const requested = input.mode === "full" || !input.quantity ? availableBundles : normalizeBundleQuantity(input.quantity, 0);
  if (!requested || requested > availableBundles) throw new Error("كمية تفكيك العرض غير صحيحة أو محجوزة لطلبات العملاء.");

  const items = await tx.select().from(storeOfferItems).where(eq(storeOfferItems.offerId, offer.id));
  if (!items.length || items.some((item: typeof storeOfferItems.$inferSelect) => !item.variantId)) throw new Error("مكونات العرض غير مكتملة ولا يمكن تفكيكها بأمان.");

  const [updatedOfferVariant] = await tx
    .update(productVariants)
    .set({ stockQuantity: sql`${productVariants.stockQuantity} - ${requested}`, updatedAt: new Date() })
    .where(and(eq(productVariants.id, offerVariant.id), sql`${productVariants.stockQuantity} - ${productVariants.reservedQuantity} >= ${requested}`))
    .returning({ stockQuantity: productVariants.stockQuantity, reservedQuantity: productVariants.reservedQuantity });
  if (!updatedOfferVariant) throw new Error("تعذر خصم وحدات العرض المطلوب تفكيكها؛ تحقق من الحجوزات.");
  const offerAfter = Number(updatedOfferVariant.stockQuantity || 0);
  await tx.insert(inventoryMovements).values({
    storeId: offer.storeId,
    productId: offer.offerProductId,
    variantId: offerVariant.id,
    type: "deduct",
    quantity: requested,
    beforeQuantity: offerAfter + requested,
    afterQuantity: offerAfter,
    reason: `Offer dissolution ${offer.id}: ${requested} inventory bundle units dismantled`,
    referenceType: "store_offer_dissolve",
    referenceId: offer.id,
    actorId: input.actorId
  });

  const restored: Array<Record<string, unknown>> = [];
  for (const item of items) {
    const restoreQuantity = Number(item.quantity || 1) * requested;
    const [updated] = await tx.update(productVariants).set({ stockQuantity: sql`${productVariants.stockQuantity} + ${restoreQuantity}`, updatedAt: new Date() }).where(eq(productVariants.id, item.variantId!)).returning({ stockQuantity: productVariants.stockQuantity });
    if (!updated) throw new Error(`تعذر إعادة مكوّن العرض إلى المخزون: ${item.title || item.variantId}`);
    const afterQuantity = Number(updated.stockQuantity || 0);
    await tx.insert(inventoryMovements).values({
      storeId: offer.storeId,
      productId: item.productId,
      variantId: item.variantId!,
      type: "add",
      quantity: restoreQuantity,
      beforeQuantity: afterQuantity - restoreQuantity,
      afterQuantity,
      reason: `Offer dissolution ${offer.id}: returned from ${requested} bundle units`,
      referenceType: "store_offer_dissolve",
      referenceId: offer.id,
      actorId: input.actorId
    });
    restored.push({ productId: item.productId, variantId: item.variantId, quantity: restoreQuantity, title: item.title });
  }

  const remainingBundles = Math.max(0, Number(offer.bundleRemainingQuantity || 0) - requested);
  const noPhysicalOrReservedStock = Number(updatedOfferVariant.stockQuantity || 0) <= 0 && Number(updatedOfferVariant.reservedQuantity || 0) <= 0;
  const [updatedOffer] = await tx.update(storeOfferCollections).set({
    bundleRemainingQuantity: remainingBundles,
    bundleDissolvedQuantity: sql`${storeOfferCollections.bundleDissolvedQuantity} + ${requested}`,
    bundleInventoryStatus: remainingBundles === 0 ? "dissolved" : "active",
    publicationState: noPhysicalOrReservedStock ? "paused" : offer.publicationState,
    status: noPhysicalOrReservedStock ? "disabled" : offer.status,
    updatedAt: new Date()
  }).where(eq(storeOfferCollections.id, offer.id)).returning();
  if (noPhysicalOrReservedStock) await tx.update(products).set({ status: "paused", updatedAt: new Date() }).where(eq(products.id, offer.offerProductId));

  const operationId = crypto.randomUUID();
  const [operation] = await tx.insert(storeOfferBundleOperations).values({
    id: operationId,
    offerId: offer.id,
    storeId: offer.storeId,
    actorId: input.actorId,
    operationType: "dissolve_inventory_product",
    quantity: requested,
    beforeRemaining: Number(offer.bundleRemainingQuantity || availableBundles),
    afterRemaining: remainingBundles,
    itemsSnapshot: restored,
    note: input.note || null,
    idempotencyKey: input.idempotencyKey || null
  }).returning();
  return { operation, offer: updatedOffer, restored, replay: false };
}

/** Called inside the normal standalone order transaction after offer stock is sold. */
export async function recordOfferProductSales(tx: DbLike, input: {
  orderId: string;
  items: Array<{ productId: string; variantId: string; quantity: number }>;
}) {
  const productIds = [...new Set(input.items.map((item) => item.productId))];
  if (!productIds.length) return [] as string[];
  const offers = await tx.select().from(storeOfferCollections).where(inArray(storeOfferCollections.offerProductId, productIds));
  const soldOfferIds: string[] = [];
  for (const offer of offers) {
    const item = input.items.find((row) => row.productId === offer.offerProductId && row.variantId === offer.offerVariantId);
    if (!item) continue;
    const [existing] = await tx.select({ id: storeOfferOrderAllocations.id }).from(storeOfferOrderAllocations).where(and(eq(storeOfferOrderAllocations.orderId, input.orderId), eq(storeOfferOrderAllocations.offerId, offer.id))).limit(1);
    if (existing) continue;
    const [updated] = await tx.update(storeOfferCollections).set({
      bundleRemainingQuantity: sql`greatest(${storeOfferCollections.bundleRemainingQuantity} - ${item.quantity}, 0)`,
      bundleInventoryStatus: sql`case when ${storeOfferCollections.bundleRemainingQuantity} - ${item.quantity} <= 0 then 'sold_out' else ${storeOfferCollections.bundleInventoryStatus} end`,
      updatedAt: new Date()
    }).where(eq(storeOfferCollections.id, offer.id)).returning({ bundleRemainingQuantity: storeOfferCollections.bundleRemainingQuantity });
    await tx.insert(storeOfferOrderAllocations).values({ orderId: input.orderId, offerId: offer.id, productId: item.productId, variantId: item.variantId, quantity: item.quantity, state: "sold" });
    if (updated) {
      if (Number(updated.bundleRemainingQuantity || 0) <= 0 && offer.offerProductId) await tx.update(products).set({ status: "paused", updatedAt: new Date() }).where(eq(products.id, offer.offerProductId));
      soldOfferIds.push(offer.id);
    }
  }
  return soldOfferIds;
}

/** Restores only the native offer-product count after a standalone order cancellation. */
export async function restoreOfferProductSalesForOrder(tx: DbLike, orderId: string) {
  const allocations = await tx.select().from(storeOfferOrderAllocations).where(and(eq(storeOfferOrderAllocations.orderId, orderId), eq(storeOfferOrderAllocations.state, "sold")));
  const restoredOfferIds: string[] = [];
  for (const allocation of allocations) {
    const [offer] = await tx.update(storeOfferCollections).set({
      bundleRemainingQuantity: sql`${storeOfferCollections.bundleRemainingQuantity} + ${allocation.quantity}`,
      bundleInventoryStatus: "active",
      updatedAt: new Date()
    }).where(eq(storeOfferCollections.id, allocation.offerId)).returning({ offerProductId: storeOfferCollections.offerProductId, publicationState: storeOfferCollections.publicationState });
    if (offer?.offerProductId && ["storefront_live", "homepage_approved"].includes(offer.publicationState || "")) {
      await tx.update(products).set({ status: "active", updatedAt: new Date() }).where(eq(products.id, offer.offerProductId));
    }
    await tx.update(storeOfferOrderAllocations).set({ state: "restored", restoredAt: new Date() }).where(eq(storeOfferOrderAllocations.id, allocation.id));
    restoredOfferIds.push(allocation.offerId);
  }
  return restoredOfferIds;
}
