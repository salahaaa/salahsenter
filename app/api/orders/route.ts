export const dynamic = "force-dynamic";

import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { nanoid } from "nanoid";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasMerchantAccess, hasRole, requireAuth } from "@/lib/auth";
import {
  couponRedemptions,
  coupons,
  db,
  financialProviders,
  notifications,
  orderItems,
  orderPayments,
  orders,
  orderShipments,
  orderStatusHistory,
  paymentMethods,
  products,
  productVariants,
  shippingMethods,
  shoppingCartItems,
  shoppingCarts,
  stores,
  systemSettings,
  users
} from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { parseListQuery } from "@/lib/api-list-utils";
import { orderCreateSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import { convertFromBase, getStoreCurrencySettings } from "@/lib/currency";
import { getPlatformSecuritySettings, isPlatformLocked } from "@/lib/security-settings";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { reserveOrderStock } from "@/lib/inventory/atomic-inventory";
import { beginIdempotentRequest, completeIdempotentRequest, getRequestIdempotencyKey, hashRequestPayload } from "@/lib/orders/idempotency";
import { enqueueJobs } from "@/lib/queue/enqueue";
import { isStrictProductionLaunch } from "@/lib/production/launch-mode";
import { invalidatePrivateApiCacheTags } from "@/lib/cache/private-api-cache";
import { enqueueAccountingIntegrationEvent } from "@/lib/integrations/accounting/events";
import { getMerchantIntegrationSettings } from "@/lib/commerce/financial-strategy";
import { createFinancialServices } from "@/lib/commerce/financial-services";
import { recordOfferProductSales } from "@/lib/offers/offer-product-inventory";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

function merchantInventoryCacheTag(storeId: string) { return `merchant:inventory:${storeId}`; }
function merchantProductsCacheTag(storeId: string) { return `merchant:products:${storeId}`; }
import { validateCoupon } from "@/lib/coupons";
import { normalizeShippingCoverage, resolveMerchantShipping } from "@/lib/shipping/coverage";
import { recordFunnelEvent } from "@/lib/analytics/funnel";
import { recordOrderAdAttribution } from "@/lib/ads/attribution";

function generateOrderNumber() {
  return `ORD-${Date.now()}-${nanoid(6).toUpperCase()}`;
}

function reservationExpiryDate(orderSettings: Record<string, unknown>) {
  if (orderSettings.enableReservationExpiry !== true) return null;
  const minutes = Number(orderSettings.reservationExpiryMinutes || 120);
  const safeMinutes = Number.isFinite(minutes) && minutes >= 5 ? Math.min(minutes, 60 * 24 * 14) : 120;
  return new Date(Date.now() + safeMinutes * 60 * 1000);
}

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const { page, pageSize, offset, q } = parseListQuery(request, { defaultPageSize: 20 });
    const status = new URL(request.url).searchParams.get("status") || "";
    const paymentStatus = new URL(request.url).searchParams.get("paymentStatus") || "";

    let scopeCondition: SQL | undefined;
    if (hasRole(session, "super_admin")) {
      // admin sees all
    } else if (hasMerchantAccess(session)) {
      const store = await getMerchantPrimaryStore(session.userId);
      if (!store) return ok({ orders: [], page, pageSize, totalCount: 0, hasNext: false, totalPages: 0 });
      scopeCondition = eq(orders.storeId, store.id);
    } else {
      scopeCondition = eq(orders.customerId, session.userId);
    }

    const conditions: SQL[] = [];
    if (scopeCondition) conditions.push(scopeCondition);
    if (q) {
      const term = `%${q}%`;
      conditions.push(or(ilike(orders.orderNumber, term), ilike(orders.currency, term))!);
    }
    if (status) conditions.push(eq(orders.statusCode, status as any));
    if (paymentStatus) conditions.push(eq(orders.paymentStatus, paymentStatus as any));
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, [{ count: totalCount }]] = await Promise.all([
      db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          customerId: orders.customerId,
          storeId: orders.storeId,
          statusCode: orders.statusCode,
          paymentStatus: orders.paymentStatus,
          currency: orders.currency,
          subtotal: orders.subtotal,
          shippingFee: orders.shippingFee,
          discountTotal: orders.discountTotal,
          grandTotal: orders.grandTotal,
          createdAt: orders.createdAt,
          updatedAt: orders.updatedAt
        })
        .from(orders)
        .where(where ? (where as any) : sql`true`)
        .orderBy(desc(orders.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(orders).where(where ? (where as any) : sql`true`)
    ]);

    return ok({ orders: rows, page, pageSize, totalCount, hasNext: offset + rows.length < totalCount, totalPages: Math.ceil(totalCount / pageSize) || 0 });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل الطلبات");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const rate = await checkIpRateLimit("orders:create", 40, 10 * 60 * 1000);
    if (!rate.allowed) return fail("طلبات شراء كثيرة، حاول بعد قليل", 429);
    const security = await getPlatformSecuritySettings();
    if (isPlatformLocked(security) || security.disabledModules.orders) return fail("استقبال الطلبات متوقف مؤقتاً", 503);
    const rawPayload = await request.json();
    const payload = orderCreateSchema.parse(rawPayload);
    if (!payload.items.length) return fail("يجب إضافة منتج واحد على الأقل للطلب", 422);

    const mergedItems = Array.from(
      payload.items.reduce((map, item) => {
        const existing = map.get(item.variantId);
        if (existing) existing.quantity += item.quantity;
        else map.set(item.variantId, { ...item });
        return map;
      }, new Map<string, (typeof payload.items)[number]>()).values()
    );
    const orderPayload = { ...payload, items: mergedItems };
    const variantIds = orderPayload.items.map((item) => item.variantId);
    const currencySettings = await getStoreCurrencySettings(orderPayload.storeId);
    const selectedCurrency = orderPayload.currency || currencySettings.defaultCurrency;
    const idempotencyKey = getRequestIdempotencyKey(request);
    if (isStrictProductionLaunch() && !idempotencyKey) {
      return fail("Idempotency-Key header is required for production checkout to prevent duplicate orders", 428);
    }
    const requestHash = hashRequestPayload({ userId: session.userId, payload: orderPayload });
    const financialSettings = await getMerchantIntegrationSettings(orderPayload.storeId);
    const financialServices = createFinancialServices(financialSettings);

    const transactionResult = await db.transaction(async (tx) => {
      const idempotency = idempotencyKey
        ? await beginIdempotentRequest(tx, { scope: "orders:create", key: idempotencyKey, userId: session.userId, requestHash })
        : { replay: false as const, key: "" };
      if (idempotency.replay) return { replay: true as const, responseBody: idempotency.responseBody, statusCode: idempotency.statusCode };
      const [store] = await tx.select().from(stores).where(and(eq(stores.id, orderPayload.storeId), eq(stores.status, "active"), eq(stores.isActive, true))).limit(1);
      if (!store) throw new Error("المتجر غير متاح حالياً");
      if (store.operationStatus && store.operationStatus !== "OPEN") throw new Error("المحل غير مفتوح حالياً ولا يستقبل طلبات إلكترونية");

      const [customer] = await tx.select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone }).from(users).where(eq(users.id, session.userId)).limit(1);

      const variantRows = await tx
        .select({
          variantId: productVariants.id,
          productId: productVariants.productId,
          sku: productVariants.sku,
          barcode: productVariants.barcode,
          title: productVariants.title,
          price: productVariants.price,
          compareAtPrice: productVariants.compareAtPrice,
          stockQuantity: productVariants.stockQuantity,
          reservedQuantity: productVariants.reservedQuantity,
          imageUrl: productVariants.imageUrl,
          images: productVariants.images,
          attributes: productVariants.attributes,
          productName: products.name,
          productCode: products.productCode,
          productCommerceType: products.productCommerceType,
          publishAt: products.publishAt,
          unpublishAt: products.unpublishAt,
          productSlug: products.slug,
          productImageUrl: products.mainImageUrl,
          productImages: products.images,
          specifications: products.specifications,
          brand: products.brand,
          warranty: products.warranty,
          originCountry: products.originCountry,
          storeId: products.storeId
        })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(and(inArray(productVariants.id, variantIds), eq(productVariants.isActive, true), eq(products.status, "active")));

      if (variantRows.length !== variantIds.length) throw new Error("بعض المنتجات غير متوفرة");
      if (variantRows.some((row) => row.storeId !== orderPayload.storeId)) throw new Error("لا يمكن إنشاء طلب بمنتجات من متاجر مختلفة");

      const itemRows = orderPayload.items.map((item) => {
        const variant = variantRows.find((row) => row.variantId === item.variantId);
        if (!variant) throw new Error("منتج غير موجود");
        if (variant.productId !== item.productId) throw new Error("بيانات المنتج لا تطابق المتغير المطلوب");
        if (variant.productCommerceType === "SHOWCASE_ONLY") throw new Error(`الصنف للعرض فقط ولا يدعم الشراء الإلكتروني: ${variant.productName}`);
        if (variant.publishAt && new Date(variant.publishAt) > new Date() || variant.unpublishAt && new Date(variant.unpublishAt) < new Date()) throw new Error(`هذا العرض أو المنتج خارج فترة النشر: ${variant.productName}`);
        const availableQuantity = Number(variant.stockQuantity || 0) - Number(variant.reservedQuantity || 0);
        if (availableQuantity < item.quantity) throw new Error(`المخزون غير كافٍ للمنتج: ${variant.productName}`);
        const unitPrice = Number(variant.price);
        const snapshot = {
          productId: variant.productId,
          variantId: variant.variantId,
          productName: variant.productName,
          productCode: variant.productCode,
          productSlug: variant.productSlug,
          sku: variant.sku,
          barcode: variant.barcode,
          variantTitle: variant.title,
          attributes: variant.attributes || {},
          specifications: variant.specifications || {},
          brand: variant.brand,
          warranty: variant.warranty,
          originCountry: variant.originCountry,
          imageUrl: variant.imageUrl || variant.productImageUrl || null,
          orderedAt: new Date().toISOString()
        };
        return { ...item, variant, unitPrice, totalPrice: unitPrice * item.quantity, snapshot };
      });

      const subtotal = itemRows.reduce((sum, item) => sum + item.totalPrice, 0);
      const [orderSetting] = await tx
        .select({ value: systemSettings.value })
        .from(systemSettings)
        .where(and(eq(systemSettings.group, `store:${orderPayload.storeId}`), eq(systemSettings.key, "order_settings")))
        .limit(1);
      const orderSettings = { minOrderAmount: 0, autoAcceptOrders: false, ...((orderSetting?.value || {}) as Record<string, unknown>) };
      if (Number(orderSettings.minOrderAmount || 0) > subtotal) throw new Error(`أقل مبلغ طلب لهذا المتجر هو ${orderSettings.minOrderAmount}`);

      if (!orderPayload.paymentMethodId) {
        const [availablePayment] = await tx.select({ id: paymentMethods.id }).from(paymentMethods).where(and(eq(paymentMethods.isActive, true), or(eq(paymentMethods.storeId, orderPayload.storeId), isNull(paymentMethods.storeId)))).limit(1);
        if (availablePayment) throw new Error("اختر وسيلة الدفع قبل إتمام الطلب");
        throw new Error("المتجر لم يهيئ أي وسيلة دفع مفعلة بعد");
      }
      if (!orderPayload.shippingMethodId) {
        const [availableShipping] = await tx.select({ id: shippingMethods.id }).from(shippingMethods).where(and(eq(shippingMethods.isActive, true), or(eq(shippingMethods.storeId, orderPayload.storeId), isNull(shippingMethods.storeId)))).limit(1);
        if (availableShipping) throw new Error("اختر وسيلة الشحن قبل إتمام الطلب");
        throw new Error("المتجر لم يهيئ أي وسيلة شحن مفعلة بعد");
      }

      let shippingFee = 0;
      const [shippingMethod] = await tx.select().from(shippingMethods).where(eq(shippingMethods.id, orderPayload.shippingMethodId)).limit(1);
      if (!shippingMethod || !shippingMethod.isActive || (shippingMethod.storeId && shippingMethod.storeId !== orderPayload.storeId)) throw new Error("وسيلة الشحن غير متاحة لهذا المتجر");
      const coverage = normalizeShippingCoverage(shippingMethod.coverageConfig);
      const shippingResolution = resolveMerchantShipping({
        baseFee: Number(shippingMethod.fee || 0),
        coverage,
        geo: { governorateId: typeof orderPayload.deliveryAddress.governorateId === "string" ? orderPayload.deliveryAddress.governorateId : null, cityId: typeof orderPayload.deliveryAddress.cityId === "string" ? orderPayload.deliveryAddress.cityId : null, districtId: typeof orderPayload.deliveryAddress.districtId === "string" ? orderPayload.deliveryAddress.districtId : null },
        subtotal
      });
      if (!shippingResolution.available) throw new Error(shippingResolution.reason || "عنوان العميل خارج تغطية الشحن");
      shippingFee = shippingResolution.fee;

      let discountTotal = 0;
      let couponResult: Awaited<ReturnType<typeof validateCoupon>> | null = null;
      if (orderPayload.couponCode) {
        couponResult = await validateCoupon({ code: orderPayload.couponCode, storeId: orderPayload.storeId, userId: session.userId, subtotal }, tx);
        if (!couponResult.valid) throw new Error(couponResult.message);
        discountTotal = couponResult.discountAmount;
      }

      const grandTotal = Math.max(0, subtotal - discountTotal) + shippingFee;
      const convertedSubtotal = convertFromBase(subtotal, currencySettings, selectedCurrency);
      const convertedShippingFee = convertFromBase(shippingFee, currencySettings, selectedCurrency);
      const convertedDiscount = convertFromBase(discountTotal, currencySettings, selectedCurrency);
      const convertedGrandTotal = convertFromBase(grandTotal, currencySettings, selectedCurrency);
      const orderNumber = generateOrderNumber();

      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          customerId: session.userId,
          storeId: orderPayload.storeId,
          statusCode: orderSettings.autoAcceptOrders ? "confirmed" : "new",
          currency: convertedGrandTotal.currency.code,
          subtotal: convertedSubtotal.amount.toString(),
          shippingFee: convertedShippingFee.amount.toString(),
          discountTotal: convertedDiscount.amount.toString(),
          grandTotal: convertedGrandTotal.amount.toString(),
          deliveryAddress: orderPayload.deliveryAddress,
          customerNote: orderPayload.customerNote,
          reservationStatus: "active",
          reservationExpiresAt: reservationExpiryDate(orderSettings)
        })
        .returning();

      if (couponResult?.valid) {
        await tx.insert(couponRedemptions).values({ couponId: couponResult.coupon.id, orderId: order.id, userId: session.userId, storeId: order.storeId, code: couponResult.code, discountAmount: convertedDiscount.amount.toString() });
        await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1`, updatedAt: new Date() }).where(eq(coupons.id, couponResult.coupon.id));
      }

      await tx.insert(orderItems).values(
        itemRows.map((item) => ({
          orderId: order.id,
          productId: item.productId,
          variantId: item.variantId,
          productName: item.variant.productName,
          variantTitle: item.variant.title,
          sku: item.variant.sku,
          productCode: item.variant.productCode,
          imageUrl: item.snapshot.imageUrl,
          productSnapshot: item.snapshot,
          quantity: item.quantity,
          unitPrice: convertFromBase(item.unitPrice, currencySettings, selectedCurrency).amount.toString(),
          totalPrice: convertFromBase(item.totalPrice, currencySettings, selectedCurrency).amount.toString()
        }))
      );

      // A successfully created store-order consumes only that store's cart rows.
      // This makes a partial multi-store checkout safe to retry: successful
      // stores cannot remain in the server cart and be ordered twice.
      const [activeCart] = await tx.select({ id: shoppingCarts.id }).from(shoppingCarts).where(and(eq(shoppingCarts.userId, session.userId), eq(shoppingCarts.status, "active"))).limit(1);
      if (activeCart) {
        await tx.delete(shoppingCartItems).where(and(eq(shoppingCartItems.cartId, activeCart.id), eq(shoppingCartItems.storeId, orderPayload.storeId), inArray(shoppingCartItems.variantId, variantIds)));
        await tx.update(shoppingCarts).set({ updatedAt: new Date() }).where(eq(shoppingCarts.id, activeCart.id));
      }

      const adAttribution = await recordOrderAdAttribution({
        tx,
        order,
        customerId: session.userId,
        orderProductIds: itemRows.map((item) => item.productId),
        attribution: orderPayload.adAttribution || null
      });

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: null,
        toStatus: order.statusCode,
        actorId: session.userId,
        note: order.statusCode === "confirmed" ? "تم إنشاء الطلب وقبوله تلقائياً حسب إعدادات المتجر." : "تم إنشاء الطلب وحجز المخزون فقط بانتظار ترحيله إلى ERP.",
        metadata: { erpSourceOfTruth: true, invoiceDeferredToErp: true }
      });

      if (orderPayload.paymentMethodId) {
        const [paymentMethod] = await tx.select().from(paymentMethods).where(eq(paymentMethods.id, orderPayload.paymentMethodId)).limit(1);
        if (!paymentMethod || !paymentMethod.isActive || (paymentMethod.storeId && paymentMethod.storeId !== orderPayload.storeId)) throw new Error("وسيلة الدفع غير متاحة لهذا المتجر");
        if (paymentMethod.financialProviderId) {
          const [provider] = await tx.select().from(financialProviders).where(eq(financialProviders.id, paymentMethod.financialProviderId)).limit(1);
          if (!provider || provider.status !== "active" || !provider.isEnabled) throw new Error("مزود الدفع متوقف أو غير مسموح حالياً");
          if (!provider.supportsDeposits) throw new Error("مزود الدفع لا يدعم مدفوعات العملاء حالياً");
        }
        await tx.insert(orderPayments).values({
          orderId: order.id,
          paymentMethodId: orderPayload.paymentMethodId,
          amount: convertedGrandTotal.amount.toString(),
          status: "pending"
        });
      }

      if (orderPayload.shippingMethodId) {
        await tx.insert(orderShipments).values({
          orderId: order.id,
          shippingMethodId: orderPayload.shippingMethodId,
          status: "pending"
        });
      }

      const financialItems = itemRows.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity, productName: item.variant.productName }));
      await reserveOrderStock(tx, {
        storeId: orderPayload.storeId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        actorId: session.userId,
        items: financialItems
      });

      const financialInvoice = await financialServices.invoice.createForOrder(tx, {
        order,
        sellerSnapshot: {
          storeId: store.id,
          storeName: store.name,
          storeNumber: store.storeNumber,
          contactPhone: store.contactPhone,
          contactEmail: store.contactEmail
        },
        buyerSnapshot: {
          customerId: customer?.id || session.userId,
          fullName: customer?.fullName || session.fullName,
          email: customer?.email || session.email,
          phone: customer?.phone || null,
          deliveryAddress: orderPayload.deliveryAddress
        },
        totalsSnapshot: {
          currency: convertedGrandTotal.currency.code,
          subtotal: convertedSubtotal.amount,
          shippingFee: convertedShippingFee.amount,
          grandTotal: convertedGrandTotal.amount,
          itemsCount: itemRows.length
        }
      });
      // Keep inventory reserved at creation. Standalone stock is finalized only
      // after a paid delivered/closed order, so COD and manual-payment orders
      // do not permanently deduct inventory before their commercial completion.
      const offerSales: string[] = [];

      const orderIntegrationPayload = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        storeId: order.storeId,
        customerId: order.customerId,
        statusCode: order.statusCode,
        paymentStatus: order.paymentStatus,
        currency: order.currency,
        subtotal: Number(order.subtotal || 0),
        shippingFee: Number(order.shippingFee || 0),
        discountTotal: Number(order.discountTotal || 0),
        grandTotal: Number(order.grandTotal || 0),
        deliveryAddress: order.deliveryAddress,
        lines: itemRows.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          sku: item.variant.sku,
          barcode: item.variant.barcode,
          productCode: item.variant.productCode,
          productName: item.variant.productName,
          variantTitle: item.variant.title,
          quantity: item.quantity,
          unitPrice: convertFromBase(item.unitPrice, currencySettings, selectedCurrency).amount,
          totalPrice: convertFromBase(item.totalPrice, currencySettings, selectedCurrency).amount
        })),
        createdAt: order.createdAt.toISOString(),
        erpInstruction: financialServices.mode === "ERP" ? "create_sales_order_or_pending_order_only" : "standalone_platform_invoice_created"
      };
      const responseBody = { order, invoice: financialInvoice, financialMode: financialServices.mode, items: itemRows.length, offerSales, storeMerchantId: store.merchantId, storeName: store.name, integration: orderIntegrationPayload, adAttributionAccepted: Boolean(adAttribution), adAttribution: adAttribution ? { campaignId: adAttribution.campaignId, clickId: adAttribution.clickId, status: adAttribution.status } : null, message: financialServices.mode === "ERP" ? "تم إنشاء الطلب وحجز المخزون. سيتم ترحيل الطلب إلى ERP لإصدار الفاتورة." : "تم إنشاء الطلب والفاتورة وخصم المخزون داخل المنصة بنجاح." };
      await tx.insert(notifications).values([
        { userId: session.userId, storeId: order.storeId, title: "تم إنشاء طلبك بنجاح", body: `تم إنشاء الطلب ${order.orderNumber}. يمكنك متابعة حالته من صفحة طلباتي.`, type: "customer_order_created", data: { orderId: order.id, orderNumber: order.orderNumber, url: `/orders/${order.id}` } },
        { userId: store.merchantId, storeId: order.storeId, title: "طلب جديد بانتظار المراجعة", body: `وصل طلب جديد ${order.orderNumber} إلى ${store.name}. تم حجز المخزون وسيتم ترحيله إلى ERP لإصدار الفاتورة.`, type: "merchant_new_order", data: { orderId: order.id, orderNumber: order.orderNumber, url: `/merchant/orders/${order.id}` } }
      ]);
      await enqueueJobs(tx, [
        {
          type: "notifications.order_created",
          priority: 5,
          dedupeKey: `notifications:order_created:${order.id}`,
          payload: { storeMerchantId: store.merchantId, storeId: order.storeId, orderId: order.id, orderNumber: order.orderNumber, storeName: store.name }
        }
      ]);
      if (idempotencyKey) await completeIdempotentRequest(tx, { scope: "orders:create", key: idempotencyKey, responseBody, statusCode: 201 });
      return { replay: false as const, responseBody };
    });

    if (transactionResult.replay) return ok(transactionResult.responseBody, { status: transactionResult.statusCode || 200 });

    const result = transactionResult.responseBody;
    await invalidatePrivateApiCacheTags([merchantInventoryCacheTag(result.order.storeId), merchantProductsCacheTag(result.order.storeId)]);
    if (result.offerSales?.length) await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.offers, PUBLIC_CACHE_TAGS.products, PUBLIC_CACHE_TAGS.stores], paths: ["/", "/offers"] });
    if (result.financialMode === "ERP") {
      await enqueueAccountingIntegrationEvent({
        eventType: "order.created",
        entityType: "order",
        entityId: result.order.id,
        storeId: result.order.storeId,
        payload: result.integration,
        dedupeKey: `accounting:order.created:${result.order.id}`
      });
    }
    await writeAuditLog({ actorId: session.userId, action: "create", category: "administrative", entityType: "order", entityId: result.order.id, afterData: result });
    await writeAuditLog({ actorId: session.userId, action: "create", category: "inventory", entityType: "inventory.order_reservation", entityId: result.order.id, afterData: { orderId: result.order.id, orderNumber: result.order.orderNumber, storeId: result.order.storeId } });
    await writeAuditLog({ actorId: session.userId, action: "create", category: "financial", entityType: "financial.order_payment_initialized", entityId: result.order.id, afterData: { orderId: result.order.id, paymentStatus: result.order.paymentStatus, grandTotal: result.order.grandTotal, currency: result.order.currency } });
    if (result.adAttribution) await writeAuditLog({ actorId: session.userId, action: "create", category: "financial", entityType: "ad.order_attribution_created", entityId: result.order.id, afterData: { orderId: result.order.id, ...result.adAttribution } });
    await recordFunnelEvent({ eventType: "order_created", userId: session.userId, storeId: result.order.storeId, orderId: result.order.id, metadata: { source: "checkout", currency: result.order.currency, grandTotal: result.order.grandTotal, adCampaignId: result.adAttribution?.campaignId || null } });
    return created(result);
  } catch (error) {
    if (error instanceof Error) return fail(error.message, (error as Error & { statusCode?: number }).statusCode || 400);
    return handleApiError(error, "تعذر إنشاء الطلب");
  }
}
