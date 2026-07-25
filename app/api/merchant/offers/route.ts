export const dynamic = "force-dynamic";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, offerCampaigns, productVariants, products, storeOfferCollections, storeOfferItems } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { storeOfferCollectionSchema } from "@/lib/validators";
import { isStoreOperational } from "@/lib/store-guards";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";
import { getMerchantIntegrationSettings } from "@/lib/commerce/financial-strategy";
import { assembleOfferInventoryProduct, type OfferComponentForAssembly } from "@/lib/offers/offer-product-inventory";
import { initialOfferPublication } from "@/lib/offers/publication-policy";

function money(value: number) {
  return Math.round((Math.max(0, value) + Number.EPSILON) * 100) / 100;
}

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ offers: [], campaigns: [] });
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية عرض عروض هذا المتجر", 403);
    const [offers, campaigns] = await Promise.all([
      db.select().from(storeOfferCollections).where(eq(storeOfferCollections.storeId, store.id)).orderBy(desc(storeOfferCollections.createdAt)).limit(200),
      db.select().from(offerCampaigns).where(eq(offerCampaigns.status, "active")).orderBy(asc(offerCampaigns.sortOrder), desc(offerCampaigns.createdAt)).limit(100)
    ]);
    return ok({ offers, campaigns });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل عروض المتجر");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = storeOfferCollectionSchema.parse(await request.json());
    const primaryStore = await getMerchantPrimaryStore(session.userId);
    const storeId = payload.storeId || primaryStore?.id;
    if (!storeId) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, storeId, [Permission.ManageStoreOffers, Permission.ManageInventory]))) return fail("لا تملك صلاحية إنشاء عروض المتجر", 403);
    if (!(await isStoreOperational(storeId))) return fail("المتجر مجمد أو غير مفعل", 403);

    // A generated offer product changes inventory. ERP stores remain ERP-owned;
    // no direct platform allocation is allowed until a certified bundle DTO flow exists.
    const integration = await getMerchantIntegrationSettings(storeId);
    if (integration.inventoryAuthority !== "platform") return fail("هذا المتجر يعتمد ERP كمصدر للمخزون. لا يمكن للمنصة تجميع عرض مخزني مباشرة؛ أنشئ الباقة في ERP ثم انتظر دعم مزامنة الباقات المعتمد.", 409);

    const productIds = [...new Set(payload.items.map((item) => item.productId))];
    const variantIds = [...new Set(payload.items.map((item) => item.variantId))];
    const [productRows, variantRows, campaign] = await Promise.all([
      db.select().from(products).where(inArray(products.id, productIds)),
      db.select().from(productVariants).where(and(inArray(productVariants.id, variantIds), eq(productVariants.isActive, true))),
      payload.campaignId ? db.select().from(offerCampaigns).where(and(eq(offerCampaigns.id, payload.campaignId), eq(offerCampaigns.status, "active"))).limit(1) : Promise.resolve([])
    ]);
    if (productRows.length !== productIds.length) return fail("يوجد صنف غير موجود داخل العرض", 422);
    if (variantRows.length !== variantIds.length) return fail("كل صنف في العرض يحتاج متغير مخزون نشطاً ومحدداً", 422);
    if (payload.campaignId && !campaign[0]) return fail("موسم العرض المختار غير نشط أو غير موجود", 422);
    if (productRows.some((product) => product.storeId !== storeId || product.status !== "active" || product.productCommerceType === "SHOWCASE_ONLY")) return fail("كل مكونات العرض يجب أن تكون منتجات نشطة وقابلة للبيع الإلكتروني من المتجر نفسه", 422);

    const components: OfferComponentForAssembly[] = payload.items.map((item) => {
      const product = productRows.find((row) => row.id === item.productId)!;
      const variant = variantRows.find((row) => row.id === item.variantId)!;
      if (variant.productId !== product.id) throw new Error(`المتغير المحدد لا يتبع الصنف: ${product.name}`);
      const originalUnitPrice = Number(variant.price || product.basePrice || 0);
      if (originalUnitPrice <= 0) throw new Error(`لا يمكن إدخال ${product.name} في عرض مخزني بدون سعر صالح.`);
      const quantity = Math.max(1, Number(item.quantity || 1));
      const discountedUnitPrice = item.offerPrice !== undefined
        ? Number(item.offerPrice)
        : payload.discountPercent > 0
          ? money(originalUnitPrice * (1 - Number(payload.discountPercent) / 100))
          : originalUnitPrice;
      return { productId: product.id, variantId: variant.id, title: product.name, imageUrl: product.mainImageUrl, quantity, originalUnitPrice, offerUnitPrice: discountedUnitPrice };
    });
    const originalTotal = money(components.reduce((sum, component) => sum + component.originalUnitPrice * component.quantity, 0));
    const computedOfferPrice = money(payload.bundlePrice || components.reduce((sum, component) => sum + component.offerUnitPrice * component.quantity, 0));
    if (computedOfferPrice <= 0 || computedOfferPrice >= originalTotal) return fail("سعر العرض يجب أن يكون أكبر من صفر وأقل من إجمالي السعر الأصلي للمكونات.", 422);

    const publication = initialOfferPublication(payload.publicationTarget);
    const result = await db.transaction(async (tx) => {
      const [offer] = await tx.insert(storeOfferCollections).values({
        campaignId: payload.campaignId || null,
        storeId,
        title: payload.title,
        description: payload.description || null,
        imageUrl: payload.imageUrl || (components.length === 1 ? components[0].imageUrl || null : null),
        status: publication.legacyStatus,
        publicationTarget: publication.publicationTarget,
        publicationState: publication.publicationState,
        reviewRequestedAt: publication.reviewRequestedAt,
        storefrontPublishedAt: publication.storefrontPublishedAt,
        homepageApprovedAt: publication.homepageApprovedAt,
        bundleInitialQuantity: payload.bundleQuantity,
        bundleRemainingQuantity: payload.bundleQuantity,
        bundleInventoryMode: "assembled_product",
        bundleInventoryStatus: "assembling",
        visibilitySchedule: payload.visibilitySchedule,
        startsAt: new Date(payload.startsAt),
        endsAt: new Date(payload.endsAt),
        // Promotion is an admin/home-exposure decision; merchants cannot set it here.
        isPromoted: false,
        promotionPackage: JSON.stringify({
          bundlePrice: computedOfferPrice,
          originalTotal,
          discountPercent: money((1 - computedOfferPrice / originalTotal) * 100),
          offerType: payload.offerType,
          publicationTarget: payload.publicationTarget,
          inventoryMode: "assembled_product"
        }),
        submittedBy: session.userId
      }).returning();

      await tx.insert(storeOfferItems).values(components.map((component, index) => ({
        offerId: offer.id,
        productId: component.productId,
        variantId: component.variantId,
        title: component.title,
        imageUrl: component.imageUrl || null,
        originalPrice: component.originalUnitPrice.toString(),
        offerPrice: component.offerUnitPrice.toString(),
        quantity: component.quantity,
        sortOrder: index
      })));

      const assembled = await assembleOfferInventoryProduct({
        tx,
        offerId: offer.id,
        storeId,
        title: offer.title,
        description: offer.description,
        imageUrl: offer.imageUrl,
        publishAt: publication.productStatus === "active" ? new Date(payload.startsAt) : null,
        unpublishAt: new Date(payload.endsAt),
        bundleQuantity: payload.bundleQuantity,
        components,
        offerProductPrice: computedOfferPrice,
        productStatus: publication.productStatus,
        actorId: session.userId
      });
      const [updatedOffer] = await tx.update(storeOfferCollections).set({
        offerProductId: assembled.offerProduct.id,
        offerVariantId: assembled.offerVariant.id,
        bundleInventoryStatus: "active",
        updatedAt: new Date()
      }).where(eq(storeOfferCollections.id, offer.id)).returning();
      return { offer: updatedOffer, offerProduct: assembled.offerProduct, offerVariant: assembled.offerVariant };
    });

    await writeAuditLog({ actorId: session.userId, action: "create", category: "inventory", entityType: "store_offer_inventory_product", entityId: result.offer.id, afterData: { offer: result.offer, offerProductId: result.offerProduct.id, offerVariantId: result.offerVariant.id, publicationTarget: payload.publicationTarget } });
    const storeSlug = primaryStore?.id === storeId ? primaryStore.slug : null;
    await invalidatePublicCache({
      tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.offers, ...(storeSlug ? [PUBLIC_CACHE_TAGS.storeSlug(storeSlug)] : [])],
      paths: ["/", "/offers", ...(storeSlug ? [`/store/${storeSlug}`] : [])]
    });
    return created({ ...result, message: publication.merchantMessage });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء عرض المتجر المخزني");
  }
}
