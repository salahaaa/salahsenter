export const dynamic = "force-dynamic";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasRole, hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, inventoryMovements, orderInvoices, orderItems, orderPayments, orders, orderStatusDefinitions, orderStatusHistory } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { recordFunnelEvent } from "@/lib/analytics/funnel";
import { markOrderAdAttributionStatus } from "@/lib/ads/attribution";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";
import { releaseOrderStock } from "@/lib/inventory/atomic-inventory";
import { enqueueJob } from "@/lib/queue/enqueue";
import { enqueueAccountingIntegrationEvent } from "@/lib/integrations/accounting/events";
import { getMerchantIntegrationSettings } from "@/lib/commerce/financial-strategy";
import { createFinancialServices } from "@/lib/commerce/financial-services";
import { restoreOfferProductSalesForOrder } from "@/lib/offers/offer-product-inventory";
import { finalizePaidDeliveredStandaloneOrder } from "@/lib/commerce/order-inventory-completion";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

const statusSchema = z.object({ statusCode: z.string().min(2).optional(), paymentStatus: z.enum(["pending", "paid", "failed", "refunded"]).optional(), note: z.string().optional() });

type OrderItemRow = typeof orderItems.$inferSelect;

async function splitItemsByReservationMode(tx: any, order: typeof orders.$inferSelect, items: OrderItemRow[]) {
  const reserved: OrderItemRow[] = [];
  const deducted: OrderItemRow[] = [];

  for (const item of items) {
    const [referencedReserve] = await tx
      .select({ id: inventoryMovements.id })
      .from(inventoryMovements)
      .where(and(eq(inventoryMovements.referenceType, "order"), eq(inventoryMovements.referenceId, order.id), eq(inventoryMovements.variantId, item.variantId), eq(inventoryMovements.type, "reserve")))
      .limit(1);
    if (referencedReserve) {
      reserved.push(item);
      continue;
    }

    const [referencedDeduct] = await tx
      .select({ id: inventoryMovements.id })
      .from(inventoryMovements)
      .where(and(eq(inventoryMovements.referenceType, "order"), eq(inventoryMovements.referenceId, order.id), eq(inventoryMovements.variantId, item.variantId), eq(inventoryMovements.type, "deduct")))
      .limit(1);
    if (referencedDeduct) {
      deducted.push(item);
      continue;
    }

    const [legacyDeduct] = await tx
      .select({ id: inventoryMovements.id })
      .from(inventoryMovements)
      .where(and(eq(inventoryMovements.variantId, item.variantId), eq(inventoryMovements.type, "deduct"), sql`${inventoryMovements.reason} like ${`%${order.orderNumber}%`}`))
      .limit(1);
    if (legacyDeduct) deducted.push(item);
  }

  return { reserved, deducted };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await requireAuth();
    const payload = statusSchema.parse(await request.json());

    const [order] = await db.select().from(orders).where(eq(orders.id, params.id)).limit(1);
    if (!order) return fail("الطلب غير موجود", 404);
    if (!hasRole(session, "super_admin") && !hasStoreAccess(session, order.storeId)) {
      return fail("لا تملك صلاحية تحديث هذا الطلب", 403);
    }
    if (!hasRole(session, "super_admin") && !(await userHasAnyStorePermission(session.userId, order.storeId, ["store.orders.status.change", Permission.ManageOrders]))) {
      return fail("لا تملك صلاحية إدارة الطلبات", 403);
    }

    const requestedStatusCode = payload.statusCode || order.statusCode;
    const [currentStatus] = await db.select().from(orderStatusDefinitions).where(eq(orderStatusDefinitions.code, order.statusCode)).limit(1);
    const [nextStatus] = await db.select().from(orderStatusDefinitions).where(and(eq(orderStatusDefinitions.code, requestedStatusCode), eq(orderStatusDefinitions.isActive, true))).limit(1);
    if (!nextStatus) return fail("حالة الطلب المطلوبة غير معرفة", 422);
    if (requestedStatusCode !== order.statusCode && currentStatus?.allowedNextCodes?.length && !currentStatus.allowedNextCodes.includes(requestedStatusCode)) {
      return fail("الانتقال بين حالتي الطلب غير مسموح من إعدادات النظام", 409);
    }
    if (requestedStatusCode === "closed" && (payload.paymentStatus || order.paymentStatus) !== "paid") {
      return fail("لا يمكن إغلاق الطلب قبل تأكيد الدفع", 409);
    }
    const financialSettings = await getMerchantIntegrationSettings(order.storeId);
    const financialServices = createFinancialServices(financialSettings);

    const result = await db.transaction(async (tx) => {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));

      if (requestedStatusCode === "cancelled" && order.statusCode !== "cancelled") {
        const [existingInvoice] = await tx.select({ id: orderInvoices.id, sourceSystem: orderInvoices.sourceSystem }).from(orderInvoices).where(eq(orderInvoices.orderId, order.id)).limit(1);
        const { reserved, deducted } = await splitItemsByReservationMode(tx, order, items);
        if (reserved.length) {
          await releaseOrderStock(tx, {
            storeId: order.storeId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            actorId: session.userId,
            movementType: "release",
            items: reserved.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity, productName: item.productName }))
          });
        }
        // A standalone invoice can exist while payment is still pending. Only
        // restore stock that was actually deducted after commercial completion.
        if (existingInvoice?.sourceSystem === "salah_center" && deducted.length) {
          await financialServices.inventory.cancelInvoicedOrder(tx, {
            storeId: order.storeId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            actorId: session.userId,
            items: deducted.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity, productName: item.productName }))
          });
          await restoreOfferProductSalesForOrder(tx, order.id);
        }
      }

      const [updatedOrder] = await tx
        .update(orders)
        .set({
          statusCode: requestedStatusCode,
          updatedAt: new Date(),
          paymentStatus: payload.paymentStatus || order.paymentStatus,
          cancelledAt: requestedStatusCode === "cancelled" ? new Date() : order.cancelledAt,
          deliveredAt: requestedStatusCode === "delivered" ? new Date() : order.deliveredAt,
          reservationStatus: requestedStatusCode === "cancelled" && order.reservationStatus === "active" ? "released" : order.reservationStatus,
          reservationReleasedAt: requestedStatusCode === "cancelled" && order.reservationStatus === "active" ? new Date() : order.reservationReleasedAt
        })
        .where(eq(orders.id, params.id))
        .returning();

      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: order.statusCode,
        toStatus: requestedStatusCode,
        actorId: session.userId,
        note: payload.note || `تغيير الحالة إلى ${nextStatus.name}`,
        metadata: { statusName: nextStatus.name, erpSourceOfTruth: true, platformDoesNotDeductStock: true }
      });

      if (["closed", "cancelled"].includes(requestedStatusCode)) {
        const [invoiceForStatus] = await tx.select({ sourceSystem: orderInvoices.sourceSystem }).from(orderInvoices).where(eq(orderInvoices.orderId, order.id)).limit(1);
        const invoiceStatus = requestedStatusCode === "closed"
          ? "closed"
          : invoiceForStatus?.sourceSystem === "salah_center"
            ? "cancelled"
            : "credit_pending";
        await tx.update(orderInvoices).set({ status: invoiceStatus, updatedAt: new Date() }).where(eq(orderInvoices.orderId, order.id));
      }

      if (payload.paymentStatus) {
        await tx.update(orderPayments).set({ status: payload.paymentStatus, paidAt: payload.paymentStatus === "paid" ? new Date() : undefined, updatedAt: new Date() }).where(eq(orderPayments.orderId, order.id));
      }

      const effectivePaymentStatus = payload.paymentStatus || order.paymentStatus;
      if (["delivered", "closed"].includes(requestedStatusCode) && effectivePaymentStatus === "paid") {
        await finalizePaidDeliveredStandaloneOrder(tx, { orderId: order.id, actorId: session.userId });
      }

      if (requestedStatusCode === "closed" && effectivePaymentStatus === "paid") {
        await financialServices.revenue.settleClosedPaidOrder(tx, order.id, session.userId);
      }

      await enqueueJob(tx, {
        type: "notifications.order_status_updated",
        priority: 3,
        dedupeKey: `notifications:order_status:${order.id}:${requestedStatusCode}:${payload.paymentStatus || order.paymentStatus}`,
        payload: { customerId: order.customerId, storeId: order.storeId, orderId: order.id, statusCode: requestedStatusCode, statusName: nextStatus.name }
      });

      if (requestedStatusCode === "delivered") await markOrderAdAttributionStatus({ tx, orderId: order.id, status: "delivered" });
      if (requestedStatusCode === "cancelled") await markOrderAdAttributionStatus({ tx, orderId: order.id, status: "cancelled" });

      return updatedOrder;
    });

    if (financialServices.mode === "ERP") {
      await enqueueAccountingIntegrationEvent({
        eventType: "order.updated",
        entityType: "order",
        entityId: order.id,
        storeId: order.storeId,
        payload: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          storeId: order.storeId,
          previousStatus: order.statusCode,
          statusCode: requestedStatusCode,
          paymentStatus: payload.paymentStatus || order.paymentStatus,
          note: payload.note || null,
          erpInstruction: requestedStatusCode === "cancelled" ? "cancel_or_credit_note_if_invoiced" : "update_sales_order_status"
        },
        dedupeKey: `accounting:order.updated:${order.id}:${requestedStatusCode}:${payload.paymentStatus || order.paymentStatus}`
      });
    }
    await writeAuditLog({ actorId: session.userId, action: "status_change", category: "administrative", entityType: "order", entityId: order.id, beforeData: order, afterData: result });
    if (requestedStatusCode === "cancelled") {
      await writeAuditLog({ actorId: session.userId, action: "update", category: "inventory", entityType: "inventory.order_reservation_released", entityId: order.id, afterData: { orderId: order.id, orderNumber: order.orderNumber, statusCode: requestedStatusCode } });
      await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.offers, PUBLIC_CACHE_TAGS.products, PUBLIC_CACHE_TAGS.stores], paths: ["/", "/offers"] });
    }
    if (payload.paymentStatus || requestedStatusCode === "closed") {
      await writeAuditLog({ actorId: session.userId, action: "update", category: "financial", entityType: "financial.order_settlement_or_payment_status", entityId: order.id, afterData: { orderId: order.id, paymentStatus: payload.paymentStatus || result.paymentStatus, statusCode: requestedStatusCode } });
    }
    if (requestedStatusCode === "delivered") await recordFunnelEvent({ eventType: "order_delivered", userId: order.customerId, storeId: order.storeId, orderId: order.id, metadata: { source: "order_status" } });
    return ok({ order: result, message: "تم تحديث حالة الطلب بنجاح" });
  } catch (error) {
    if (error instanceof Error && (error as Error & { statusCode?: number }).statusCode) {
      return fail(error.message, (error as Error & { statusCode: number }).statusCode);
    }
    return handleApiError(error, "تعذر تحديث حالة الطلب");
  }
}
