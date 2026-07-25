export const dynamic = "force-dynamic";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, inventoryMovements, orderItems, productAttributes, productAttributeValues, productImages, productLifecycleEvents, productVariantAttributeValues, products, productVariants, shoppingCartItems, stores, variantChangeLogs } from "@/lib/db";
import { optionalUrlOrPathSchema, requiredUrlOrPathSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";
import { isStoreOperational } from "@/lib/store-guards";
import { uniqueSlug } from "@/lib/slug";
import { generateProductCode } from "@/lib/product-coding";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";
import { invalidatePrivateApiCacheTags } from "@/lib/cache/private-api-cache";
import { assertNotGeneratedOfferInventory } from "@/lib/offers/guards";

function merchantProductsCacheTag(storeId: string) { return `merchant:products:${storeId}`; }
function merchantInventoryCacheTag(storeId: string) { return `merchant:inventory:${storeId}`; }

const editVariantSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().optional().default(""),
  barcode: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  price: z.coerce.number().min(0),
  compareAtPrice: z.coerce.number().min(0).optional().nullable(),
  priceAdjustment: z.coerce.number().default(0),
  stockQuantity: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(5),
  imageUrl: optionalUrlOrPathSchema,
  images: z.array(requiredUrlOrPathSchema).optional().default([]),
  attributes: z.record(z.string()).optional().default({}),
  attributeValueIds: z.array(z.string().uuid()).optional().default([]),
  unitId: z.string().uuid().optional().nullable(),
  sizeId: z.string().uuid().optional().nullable(),
  colorId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true)
});

const editProductSchema = z.object({
  categoryId: z.string().uuid().optional().nullable(),
  name: z.string().min(2),
  englishName: z.string().optional().nullable(),
  slug: z.string().min(2).optional(),
  productCode: z.string().optional().nullable(),
  codeMode: z.enum(["auto", "manual"]).default("auto"),
  barcode: z.string().optional().nullable(),
  shortDescription: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  originCountry: z.string().optional().nullable(),
  warranty: z.string().optional().nullable(),
  youtubeUrl: optionalUrlOrPathSchema,
  status: z.enum(["draft", "review", "active", "paused", "inactive", "archived"]),
  publishAt: z.string().datetime().optional().nullable(),
  unpublishAt: z.string().datetime().optional().nullable(),
  basePrice: z.coerce.number().min(0).optional().nullable(),
  mainImageUrl: optionalUrlOrPathSchema,
  images: z.array(requiredUrlOrPathSchema).optional().default([]),
  specifications: z.record(z.string()).optional().default({}),
  pricingMode: z.enum(["base_adjustment", "independent"]).default("independent"),
  inventoryMode: z.enum(["product", "variant"]).default("variant"),
  productCommerceType: z.enum(["ONLINE_SALES", "SHOWCASE_ONLY"]).default("ONLINE_SALES"),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  variants: z.array(editVariantSchema).optional().default([])
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) return fail("المنتج غير موجود", 404);
    if (!hasStoreAccess(session, product.storeId)) return fail("لا تملك صلاحية عرض هذا المنتج", 403);
    if (!(await userHasAnyStorePermission(session.userId, product.storeId, ["store.products.view", Permission.ManageProducts]))) return fail("لا تملك صلاحية عرض المنتجات", 403);
    const [variants, images, variantAttributeLinks] = await Promise.all([
      db.select().from(productVariants).where(eq(productVariants.productId, product.id)),
      db.select().from(productImages).where(eq(productImages.productId, product.id)),
      db
        .select({ variantId: productVariantAttributeValues.variantId, valueId: productVariantAttributeValues.valueId, attributeName: productAttributeValues.value })
        .from(productVariantAttributeValues)
        .innerJoin(productAttributeValues, eq(productVariantAttributeValues.valueId, productAttributeValues.id))
        .where(inArray(productVariantAttributeValues.variantId, (await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, product.id))).map((v) => v.id)))
    ]);
    // Attach the attribute value ids to each variant so the edit form can re-bind them.
    const linksByVariant = new Map<string, string[]>();
    for (const link of variantAttributeLinks) {
      const arr = linksByVariant.get(link.variantId) || [];
      arr.push(link.valueId);
      linksByVariant.set(link.variantId, arr);
    }
    const variantsWithLinks = variants.map((variant) => ({ ...variant, attributeValueIds: linksByVariant.get(variant.id) || [] }));
    return ok({ product, variants: variantsWithLinks, images });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل المنتج");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = editProductSchema.parse(await request.json());
    const [before] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!before) return fail("المنتج غير موجود", 404);
    if (!hasStoreAccess(session, before.storeId)) return fail("لا تملك صلاحية تعديل هذا المنتج", 403);
    if (!(await userHasAnyStorePermission(session.userId, before.storeId, ["store.products.edit", Permission.ManageProducts]))) return fail("لا تملك صلاحية تعديل المنتجات", 403);
    if (!(await isStoreOperational(before.storeId))) return fail("المتجر مجمد أو غير مفعل؛ لا يمكن تعديل المنتجات", 403);
    await assertNotGeneratedOfferInventory({ productId: before.id });
    if (payload.status === "active" && Number(payload.basePrice || 0) <= 0 && !payload.variants.some((variant) => Number(variant.price || 0) > 0)) return fail("لا يمكن نشر منتج بدون سعر أكبر من صفر", 422);
    if (payload.status === "active" && payload.codeMode === "manual" && !(payload.productCode || before.productCode)?.trim()) return fail("لا يمكن نشر منتج بكود يدوي بدون رقم/كود المنتج", 422);
    const nextProductCode = payload.codeMode === "manual"
      ? (payload.productCode || before.productCode)
      : (payload.productCode || before.productCode || await generateProductCode(db, before.storeId, payload.categoryId));

    const allValueIds = [...new Set(payload.variants.flatMap((variant) => variant.attributeValueIds || []))];
    const validValueRows = allValueIds.length
      ? await db
          .select({ id: productAttributeValues.id, attributeId: productAttributeValues.attributeId })
          .from(productAttributeValues)
          .innerJoin(productAttributes, eq(productAttributeValues.attributeId, productAttributes.id))
          .where(and(inArray(productAttributeValues.id, allValueIds), eq(productAttributes.storeId, before.storeId), eq(productAttributes.isActive, true), eq(productAttributeValues.isActive, true)))
      : [];
    if (validValueRows.length !== allValueIds.length) return fail("بعض قيم الخصائص غير صحيحة أو لا تتبع هذا المتجر", 422);
    const validValueToAttribute = new Map(validValueRows.map((value) => [value.id, value.attributeId]));
    for (const variant of payload.variants) {
      const attributeIds = (variant.attributeValueIds || []).map((valueId) => validValueToAttribute.get(valueId)?.toString()).filter(Boolean) as string[];
      if (new Set(attributeIds).size !== attributeIds.length) return fail("لا يمكن اختيار أكثر من قيمة لنفس الخاصية داخل نفس المتغير", 422);
    }
    const skus = payload.variants.map((variant) => variant.sku.trim()).filter(Boolean);
    if (new Set(skus.map((sku) => sku.toLowerCase())).size !== skus.length) return fail("يوجد SKU مكرر داخل المتغيرات. اجعل كل SKU فريدًا قبل الحفظ.", 422);
    if (skus.length) {
      const conflicts = await db.select({ sku: productVariants.sku, productId: productVariants.productId }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(and(eq(products.storeId, before.storeId), inArray(productVariants.sku, skus), sql`${productVariants.productId} <> ${id}`)).limit(10);
      if (conflicts.length) return fail(`SKU مستخدم مسبقًا في منتج آخر: ${conflicts.map((row) => row.sku).join("، ")}`, 409);
    }

    const result = await db.transaction(async (tx) => {
      const [updatedProduct] = await tx
        .update(products)
        .set({
          categoryId: payload.categoryId || null,
          name: payload.name,
          englishName: payload.englishName || null,
          slug: payload.slug || before.slug || uniqueSlug(payload.name),
          productCode: nextProductCode,
          codeMode: payload.codeMode,
          barcode: payload.barcode || null,
          shortDescription: payload.shortDescription || null,
          description: payload.description || null,
          brand: payload.brand || null,
          originCountry: payload.originCountry || null,
          warranty: payload.warranty || null,
          youtubeUrl: payload.youtubeUrl || null,
          status: payload.status,
          publishAt: payload.publishAt ? new Date(payload.publishAt) : payload.publishAt === null ? null : before.publishAt,
          unpublishAt: payload.unpublishAt ? new Date(payload.unpublishAt) : payload.unpublishAt === null ? null : before.unpublishAt,
          basePrice: payload.basePrice?.toString() || null,
          mainImageUrl: payload.mainImageUrl || null,
          images: payload.images,
          specifications: payload.specifications,
          pricingMode: payload.pricingMode,
          inventoryMode: payload.inventoryMode,
          productCommerceType: payload.productCommerceType,
          discountPercent: payload.discountPercent.toString(),
          updatedAt: new Date()
        })
        .where(eq(products.id, id))
        .returning();

      if (before.status !== updatedProduct.status) await tx.insert(productLifecycleEvents).values({ productId: id, storeId: before.storeId, fromStatus: before.status, toStatus: updatedProduct.status, reason: "تعديل التاجر", actorId: session.userId, metadata: { publishAt: updatedProduct.publishAt, unpublishAt: updatedProduct.unpublishAt } });

      await tx.delete(productImages).where(and(eq(productImages.productId, id), isNull(productImages.variantId), isNull(productImages.attributeValueId)));
      const uniqueImages = [...new Set([payload.mainImageUrl || "", ...payload.images].filter(Boolean))];
      if (uniqueImages.length) {
        await tx.insert(productImages).values(uniqueImages.map((url, index) => ({
          productId: id,
          url,
          alt: payload.name,
          isPrimary: index === 0,
          sortOrder: index
        })));
      }

      const existingVariants = await tx.select().from(productVariants).where(eq(productVariants.productId, id));
      const existingById = new Map(existingVariants.map((variant) => [variant.id, variant]));
      const savedVariants = [];

      for (let index = 0; index < payload.variants.length; index++) {
        const variant = payload.variants[index];
        if (variant.id && existingById.has(variant.id)) {
          const beforeVariant = existingById.get(variant.id)!;
          const [updatedVariant] = await tx
            .update(productVariants)
            .set({
              sku: variant.sku || beforeVariant.sku,
              barcode: variant.barcode || null,
              title: variant.title || "افتراضي",
              price: variant.price.toString(),
              compareAtPrice: variant.compareAtPrice?.toString() || null,
              priceAdjustment: variant.priceAdjustment.toString(),
              stockQuantity: variant.stockQuantity,
              lowStockThreshold: variant.lowStockThreshold,
              imageUrl: variant.imageUrl || null,
              images: variant.images || [],
              attributes: variant.attributes || {},
              unitId: variant.unitId ?? beforeVariant.unitId ?? null,
              sizeId: variant.sizeId ?? beforeVariant.sizeId ?? null,
              colorId: variant.colorId ?? beforeVariant.colorId ?? null,
              isActive: variant.isActive,
              updatedAt: new Date()
            })
            .where(eq(productVariants.id, variant.id))
            .returning();
          savedVariants.push(updatedVariant);

          // Sync the variant ↔ attribute-value links so the merchant can add/change/remove
          // colors, sizes, packs etc. on an existing variant (the core of this fix).
          await tx.delete(productVariantAttributeValues).where(eq(productVariantAttributeValues.variantId, variant.id!));
          if (variant.attributeValueIds?.length) {
            const links = variant.attributeValueIds
              .map((valueId) => ({ valueId, attributeId: validValueToAttribute.get(valueId) }))
              .filter((l): l is { valueId: string; attributeId: string } => Boolean(l.attributeId))
              // dedupe by attributeId so the (variantId, attributeId) PK stays valid
              .filter((link, pos, arr) => arr.findIndex((x) => x.attributeId === link.attributeId) === pos);
            if (links.length) {
              await tx.insert(productVariantAttributeValues).values(
                links.map((link) => ({ variantId: variant.id!, attributeId: link.attributeId, valueId: link.valueId }))
              ).onConflictDoNothing();
            }
          }

          const changedFields = [
            beforeVariant.sku !== updatedVariant.sku ? "sku" : null,
            beforeVariant.barcode !== updatedVariant.barcode ? "barcode" : null,
            beforeVariant.price !== updatedVariant.price ? "price" : null,
            beforeVariant.stockQuantity !== updatedVariant.stockQuantity ? "stock" : null,
            beforeVariant.imageUrl !== updatedVariant.imageUrl ? "image" : null
          ].filter(Boolean);
          if (changedFields.length) await tx.insert(variantChangeLogs).values({ variantId: updatedVariant.id, productId: id, storeId: before.storeId, changeType: changedFields.join("_"), beforeData: { sku: beforeVariant.sku, barcode: beforeVariant.barcode, price: beforeVariant.price, stockQuantity: beforeVariant.stockQuantity, imageUrl: beforeVariant.imageUrl }, afterData: { sku: updatedVariant.sku, barcode: updatedVariant.barcode, price: updatedVariant.price, stockQuantity: updatedVariant.stockQuantity, imageUrl: updatedVariant.imageUrl }, reason: "تعديل المتغير", actorId: session.userId });

          if (beforeVariant.stockQuantity !== variant.stockQuantity) {
            await tx.insert(inventoryMovements).values({
              storeId: before.storeId,
              productId: id,
              variantId: updatedVariant.id,
              type: "adjust",
              quantity: Math.abs(variant.stockQuantity - beforeVariant.stockQuantity),
              beforeQuantity: beforeVariant.stockQuantity,
              afterQuantity: variant.stockQuantity,
              reason: "Product edit stock adjustment",
              actorId: session.userId
            });
          }
        } else {
          const [createdVariant] = await tx
            .insert(productVariants)
            .values({
              productId: id,
              sku: variant.sku || `${updatedProduct.productCode || updatedProduct.slug}-${String(index + 1).padStart(3, "0")}`,
              barcode: variant.barcode || null,
              title: variant.title || "افتراضي",
              price: variant.price.toString(),
              compareAtPrice: variant.compareAtPrice?.toString() || null,
              priceAdjustment: variant.priceAdjustment.toString(),
              stockQuantity: variant.stockQuantity,
              lowStockThreshold: variant.lowStockThreshold,
              imageUrl: variant.imageUrl || null,
              images: variant.images || [],
              attributes: variant.attributes || {},
              unitId: variant.unitId ?? null,
              sizeId: variant.sizeId ?? null,
              colorId: variant.colorId ?? null,
              isActive: variant.isActive
            })
            .returning();
          savedVariants.push(createdVariant);
          await tx.insert(variantChangeLogs).values({ variantId: createdVariant.id, productId: id, storeId: before.storeId, changeType: "created", beforeData: {}, afterData: { sku: createdVariant.sku, barcode: createdVariant.barcode, price: createdVariant.price, stockQuantity: createdVariant.stockQuantity }, reason: "إضافة متغير", actorId: session.userId });

          // Bind new variant to its attribute values.
          if (variant.attributeValueIds?.length) {
            const links = variant.attributeValueIds
              .map((valueId) => ({ valueId, attributeId: validValueToAttribute.get(valueId) }))
              .filter((l): l is { valueId: string; attributeId: string } => Boolean(l.attributeId))
              .filter((link, pos, arr) => arr.findIndex((x) => x.attributeId === link.attributeId) === pos);
            if (links.length) {
              await tx.insert(productVariantAttributeValues).values(
                links.map((link) => ({ variantId: createdVariant.id, attributeId: link.attributeId, valueId: link.valueId }))
              ).onConflictDoNothing();
            }
          }

          if (createdVariant.stockQuantity > 0) {
            await tx.insert(inventoryMovements).values({
              storeId: before.storeId,
              productId: id,
              variantId: createdVariant.id,
              type: "add",
              quantity: createdVariant.stockQuantity,
              beforeQuantity: 0,
              afterQuantity: createdVariant.stockQuantity,
              reason: "New variant added from product editor",
              actorId: session.userId
            });
          }
        }
      }

      return { product: updatedProduct, variants: savedVariants };
    });

    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "product", entityId: id, beforeData: before, afterData: result });
    await invalidatePrivateApiCacheTags([merchantProductsCacheTag(before.storeId), merchantInventoryCacheTag(before.storeId)]);
    const [store] = await db.select({ slug: stores.slug }).from(stores).where(eq(stores.id, before.storeId)).limit(1);
    await invalidatePublicCache({
      tags: [
        PUBLIC_CACHE_TAGS.home,
        PUBLIC_CACHE_TAGS.products,
        ...(store?.slug
          ? [
              PUBLIC_CACHE_TAGS.storeSlug(store.slug),
              PUBLIC_CACHE_TAGS.productSlug(store.slug, before.slug),
              PUBLIC_CACHE_TAGS.productSlug(store.slug, result.product.slug)
            ]
          : [])
      ],
      paths: [
        "/",
        ...(store?.slug
          ? [`/store/${store.slug}`, `/store/${store.slug}/products/${before.slug}`, `/store/${store.slug}/products/${result.product.slug}`]
          : [])
      ]
    });
    return ok({ ...result, message: "تم تعديل المنتج بالكامل بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر تعديل المنتج");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) return fail("المنتج غير موجود", 404);
    if (!hasStoreAccess(session, product.storeId)) return fail("لا تملك صلاحية حذف هذا المنتج", 403);
    if (!(await userHasAnyStorePermission(session.userId, product.storeId, ["store.products.delete", Permission.ManageProducts]))) return fail("لا تملك صلاحية حذف المنتجات", 403);
    if (!(await isStoreOperational(product.storeId))) return fail("المتجر مجمد أو غير مفعل؛ لا يمكن حذف المنتجات", 403);

    const [movementCount, orderCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(inventoryMovements).where(eq(inventoryMovements.productId, id)),
      db.select({ count: sql<number>`count(*)::int` }).from(orderItems).where(eq(orderItems.productId, id))
    ]);
    const movements = Number(movementCount[0]?.count || 0);
    const orders = Number(orderCount[0]?.count || 0);
    if (movements > 0 || orders > 0) {
      return fail(`لا يمكن حذف الصنف لأنه يحتوي على حركة أو طلبات. الحركات: ${movements}، الطلبات: ${orders}. يمكنك أرشفته بدلاً من الحذف.`, 409);
    }

    const [store] = await db.select({ slug: stores.slug }).from(stores).where(eq(stores.id, product.storeId)).limit(1);
    await db.transaction(async (tx) => {
      await tx.delete(shoppingCartItems).where(eq(shoppingCartItems.productId, id));
      await tx.delete(products).where(eq(products.id, id));
    });

    await invalidatePrivateApiCacheTags([merchantProductsCacheTag(product.storeId), merchantInventoryCacheTag(product.storeId)]);
    await invalidatePublicCache({
      tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.products, ...(store?.slug ? [PUBLIC_CACHE_TAGS.storeSlug(store.slug), PUBLIC_CACHE_TAGS.productSlug(store.slug, product.slug)] : [])],
      paths: ["/", ...(store?.slug ? [`/store/${store.slug}`, `/store/${store.slug}/products/${product.slug}`] : [])]
    });
    await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "product", entityId: id, beforeData: product, afterData: { deleted: true, noMovements: true } });
    return ok({ message: "تم حذف الصنف لأنه لا يحتوي على أي حركة أو طلبات" });
  } catch (error) {
    return handleApiError(error, "تعذر حذف الصنف");
  }
}
