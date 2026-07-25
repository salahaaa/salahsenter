export const dynamic = "force-dynamic";

import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { requireAuth, hasStoreAccess } from "@/lib/auth";
import {
  categories,
  db,
  inventoryMovements,
  productAttributes,
  productAttributeValues,
  productImages,
  productLifecycleEvents,
  products,
  productSpecifications,
  productVariantAttributeValues,
  productVariants,
  units
} from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { buildVariantTitle, generateProductCode } from "@/lib/product-coding";
import { uniqueSlug } from "@/lib/slug";
import { inlineMediaFlagSql, nonInlineMediaSql } from "@/lib/inline-media";
import { parseListQuery } from "@/lib/api-list-utils";
import { productSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import { isStoreOperational } from "@/lib/store-guards";
import { formatSetupMissingMessage, getStoreSetupStatus } from "@/lib/merchant-readiness";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";
import { apiCacheKey, cacheHeader, getCachedPrivateApi, invalidatePrivateApiCacheTags } from "@/lib/cache/private-api-cache";
import { assertRentalLimit, lockRentalEntitlement } from "@/lib/rentals/service";

function merchantProductsCacheTag(storeId: string) { return `merchant:products:${storeId}`; }
function merchantInventoryCacheTag(storeId: string) { return `merchant:inventory:${storeId}`; }

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ products: [], page: 1, pageSize: 20, totalCount: 0, hasNext: false, totalPages: 0 });
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية عرض هذا المتجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, store.id, ["store.products.view", Permission.ManageProducts]))) return fail("لا تملك صلاحية عرض المنتجات", 403);

    const { page, pageSize, offset, q } = parseListQuery(request, { defaultPageSize: 20 });
    const status = new URL(request.url).searchParams.get("status") || "";
    const conditions: SQL[] = [eq(products.storeId, store.id)];
    if (q) {
      const term = `%${q}%`;
      conditions.push(or(ilike(products.name, term), ilike(products.slug, term), ilike(products.productCode, term), ilike(products.barcode, term), ilike(products.englishName, term))!);
    }
    if (status) conditions.push(eq(products.status, status as any));
    const where = and(...conditions);

    const cached = await getCachedPrivateApi(
      apiCacheKey(["merchant:products", session.userId, store.id, page, pageSize, q, status]),
      async () => {
        const [rows, [{ count: totalCount }]] = await Promise.all([
          db
            .select({
              id: products.id,
              name: products.name,
              englishName: products.englishName,
              slug: products.slug,
              productCode: products.productCode,
              barcode: products.barcode,
              brand: products.brand,
              type: products.type,
              status: products.status,
              basePrice: products.basePrice,
              discountPercent: products.discountPercent,
              isPromoted: products.isPromoted,
              viewCount: products.viewCount,
              soldCount: products.soldCount,
              ratingAverage: products.ratingAverage,
              mainImageUrl: nonInlineMediaSql(products.mainImageUrl),
              hasInlineMainImage: inlineMediaFlagSql(products.mainImageUrl),
              categoryId: products.categoryId,
              createdAt: products.createdAt
            })
            .from(products)
            .where(where)
            .orderBy(desc(products.createdAt))
            .limit(pageSize)
            .offset(offset),
          db.select({ count: sql<number>`count(*)::int` }).from(products).where(where)
        ]);
        return { products: rows, page, pageSize, totalCount, hasNext: offset + rows.length < totalCount, totalPages: Math.ceil(totalCount / pageSize) || 0 };
      },
      { ttlSeconds: 30, tags: [merchantProductsCacheTag(store.id)], encrypted: true }
    );
    const response = ok(cached.value);
    response.headers.set("x-redis-cache", cacheHeader(cached.hit));
    return response;
  } catch (error) {
    return handleApiError(error, "تعذر تحميل المنتجات");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = productSchema.parse(await request.json());
    const primaryStore = await getMerchantPrimaryStore(session.userId);
    const storeId = payload.storeId || primaryStore?.id;

    if (!storeId) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, storeId, ["store.products.create", Permission.ManageProducts]))) return fail("لا تملك صلاحية إنشاء المنتجات", 403);
    if (!(await isStoreOperational(storeId))) return fail("المتجر مجمد أو غير مفعل؛ لا يمكن تنفيذ عمليات تشغيلية حتى إعادة فتحه من الأدمن", 403);
    const setupStatus = await getStoreSetupStatus(session.userId, { id: storeId } as any);
    if (!setupStatus.ready) return fail(formatSetupMissingMessage(setupStatus), 409, { setup: setupStatus });
    if (payload.categoryId) {
      const [categoryRow] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, payload.categoryId), eq(categories.storeId, storeId), eq(categories.isActive, true))).limit(1);
      if (!categoryRow) return fail("القسم/المجموعة غير صحيحة أو غير تابعة لهذا المتجر", 422);
    }

    const incomingVariants = payload.variants || [];
    const allUnitIds = [...new Set(incomingVariants.map((variant) => variant.unitId).filter(Boolean) as string[])];
    const validUnitRows = allUnitIds.length
      ? await db.select({ id: units.id }).from(units).where(and(inArray(units.id, allUnitIds), eq(units.storeId, storeId), eq(units.isActive, true)))
      : [];
    if (validUnitRows.length !== allUnitIds.length) return fail("بعض وحدات البيع غير صحيحة أو غير تابعة لهذا المتجر", 422);

    const allValueIds = [...new Set(incomingVariants.flatMap((variant) => variant.attributeValueIds || []))];
    const valueRows = allValueIds.length
      ? await db
        .select({ id: productAttributeValues.id, attributeId: productAttributeValues.attributeId, value: productAttributeValues.value })
        .from(productAttributeValues)
        .innerJoin(productAttributes, eq(productAttributeValues.attributeId, productAttributes.id))
        .where(and(inArray(productAttributeValues.id, allValueIds), eq(productAttributes.storeId, storeId), eq(productAttributes.isActive, true), eq(productAttributeValues.isActive, true)))
      : [];
    if (valueRows.length !== allValueIds.length) return fail("بعض قيم المتغيرات غير صحيحة أو غير تابعة لهذا المتجر", 422);
    const valueById = new Map(valueRows.map((value) => [value.id, value]));
    for (const variant of incomingVariants) {
      const attributeIds = (variant.attributeValueIds || []).map((valueId) => valueById.get(valueId)?.attributeId).filter(Boolean) as string[];
      if (new Set(attributeIds).size !== attributeIds.length) return fail("لا يمكن اختيار أكثر من قيمة لنفس الخاصية داخل نفس المتغير", 422);
    }
    const skus = incomingVariants.map((variant) => variant.sku.trim()).filter(Boolean);
    if (new Set(skus.map((sku) => sku.toLowerCase())).size !== skus.length) return fail("يوجد SKU مكرر داخل المتغيرات. اجعل كل SKU فريدًا قبل الحفظ.", 422);
    if (skus.length) {
      const conflicts = await db.select({ sku: productVariants.sku }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(and(eq(products.storeId, storeId), inArray(productVariants.sku, skus))).limit(10);
      if (conflicts.length) return fail(`SKU مستخدم مسبقًا داخل متجرك: ${conflicts.map((row) => row.sku).join("، ")}`, 409);
    }

    const result = await db.transaction(async (tx) => {
      await lockRentalEntitlement(storeId, tx);
      const [{ count: currentCount }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(eq(products.storeId, storeId));
      await assertRentalLimit({ storeId, resource: "products", currentCount, tx });

      const productCode = payload.codeMode === "manual" && payload.productCode ? payload.productCode : await generateProductCode(tx, storeId, payload.categoryId);

      const [product] = await tx
        .insert(products)
        .values({
          storeId,
          categoryId: payload.categoryId || null,
          name: payload.name,
          englishName: payload.englishName,
          slug: payload.slug || uniqueSlug(payload.name),
          productCode,
          codeMode: payload.codeMode,
          barcode: payload.barcode,
          shortDescription: payload.shortDescription,
          description: payload.description,
          brand: payload.brand,
          originCountry: payload.originCountry,
          warranty: payload.warranty,
          youtubeUrl: payload.youtubeUrl || null,
          type: payload.type,
          status: payload.status,
          publishAt: payload.publishAt ? new Date(payload.publishAt) : null,
          unpublishAt: payload.unpublishAt ? new Date(payload.unpublishAt) : null,
          basePrice: payload.basePrice?.toString(),
          mainImageUrl: payload.mainImageUrl || null,
          images: payload.images,
          specifications: payload.specifications,
          pricingMode: payload.pricingMode,
          inventoryMode: payload.inventoryMode,
          productCommerceType: payload.productCommerceType,
          discountPercent: payload.discountPercent.toString()
        })
        .returning();

      const variants = incomingVariants.length > 0
        ? incomingVariants
        : [
            {
              sku: `${product.productCode || product.slug}-DEFAULT`,
              title: "افتراضي",
              barcode: undefined,
              unitId: null,
              sizeId: null,
              colorId: null,
              price: payload.basePrice || 0,
              compareAtPrice: undefined,
              priceAdjustment: 0,
              stockQuantity: 0,
              lowStockThreshold: 5,
              imageUrl: payload.mainImageUrl || "",
              images: payload.images,
              attributes: {},
              attributeValueIds: []
            }
          ];

      const createdVariants = await tx
        .insert(productVariants)
        .values(
          variants.map((variant, index) => ({
            productId: product.id,
            sku: variant.sku || `${product.productCode || product.slug}-${String(index + 1).padStart(3, "0")}`,
            barcode: variant.barcode,
            title: variant.title || buildVariantTitle(variant.attributes),
            unitId: variant.unitId || null,
            sizeId: variant.sizeId || null,
            colorId: variant.colorId || null,
            price: variant.price.toString(),
            compareAtPrice: variant.compareAtPrice?.toString(),
            priceAdjustment: variant.priceAdjustment.toString(),
            stockQuantity: variant.stockQuantity,
            lowStockThreshold: variant.lowStockThreshold,
            imageUrl: variant.imageUrl || null,
            images: variant.images || [],
            attributes: variant.attributes || {}
          }))
        )
        .returning();

      const variantLinks = createdVariants.flatMap((createdVariant, index) => {
        const original = variants[index];
        return (original.attributeValueIds || [])
          .map((valueId) => valueById.get(valueId))
          .filter(Boolean)
          .map((value) => ({ variantId: createdVariant.id, attributeId: value!.attributeId, valueId: value!.id }));
      });
      if (variantLinks.length) await tx.insert(productVariantAttributeValues).values(variantLinks).onConflictDoNothing();

      const imageRows = [
        ...(payload.mainImageUrl ? [{ url: payload.mainImageUrl, alt: payload.name, isPrimary: true, sortOrder: 0 }] : []),
        ...payload.images.map((url, index) => ({ url, alt: payload.name, isPrimary: false, sortOrder: index + 1 })),
        ...payload.productImages.map((image, index) => ({
          url: image.url,
          alt: image.alt || payload.name,
          isPrimary: Boolean(image.isPrimary),
          attributeValueId: image.attributeValueId || null,
          sortOrder: index + 100
        }))
      ];
      if (imageRows.length) await tx.insert(productImages).values(imageRows.map((image) => ({ productId: product.id, ...image })));

      const specRows = Object.entries(payload.specifications).map(([name, value], index) => ({ productId: product.id, name, value, sortOrder: index }));
      if (specRows.length) await tx.insert(productSpecifications).values(specRows);

      for (const variant of createdVariants) {
        if (variant.stockQuantity > 0) {
          await tx.insert(inventoryMovements).values({
            storeId,
            productId: product.id,
            variantId: variant.id,
            type: "add",
            quantity: variant.stockQuantity,
            beforeQuantity: 0,
            afterQuantity: variant.stockQuantity,
            reason: "Initial stock",
            actorId: session.userId
          });
        }
      }

      await tx.insert(productLifecycleEvents).values({ productId: product.id, storeId, fromStatus: null, toStatus: product.status, reason: "إنشاء المنتج", actorId: session.userId, metadata: { publishAt: product.publishAt, unpublishAt: product.unpublishAt } });
      return { product, variants: createdVariants };
    });

    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "product", entityId: result.product.id, afterData: result });
    await invalidatePrivateApiCacheTags([merchantProductsCacheTag(storeId), merchantInventoryCacheTag(storeId)]);
    const storeSlug = primaryStore?.id === storeId ? primaryStore.slug : null;
    await invalidatePublicCache({
      tags: [
        PUBLIC_CACHE_TAGS.home,
        PUBLIC_CACHE_TAGS.products,
        ...(storeSlug ? [PUBLIC_CACHE_TAGS.storeSlug(storeSlug), PUBLIC_CACHE_TAGS.productSlug(storeSlug, result.product.slug)] : [])
      ],
      paths: ["/", ...(storeSlug ? [`/store/${storeSlug}`, `/store/${storeSlug}/products/${result.product.slug}`] : [])]
    });
    return created({ ...result, message: "تم حفظ المنتج بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ المنتج");
  }
}
