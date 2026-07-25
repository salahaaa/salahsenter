export const dynamic = "force-dynamic";

import { and, asc, eq, or } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { db, orderShipments, orderStatusHistory, orders, shippingMethods, stores, users } from "@/lib/db";
import { orderStatusLabels } from "@/lib/order-details";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { normalizeShippingCoverage } from "@/lib/shipping/coverage";

const nextStep: Record<string, string> = {
  new: "بانتظار قبول التاجر للطلب",
  confirmed: "التاجر يجهز الطلب للشحن",
  preparing: "الطلب قيد التجهيز لدى التاجر",
  ready_to_ship: "الطلب جاهز لتسليمه للمندوب",
  shipped: "الطلب في الطريق إليك",
  delivered: "تم التسليم؛ سيؤكد التاجر إغلاق الطلب",
  closed: "اكتملت دورة الطلب بنجاح",
  cancelled: "تم إلغاء الطلب"
};

export async function GET(request: Request) {
  try {
    const rate = await checkIpRateLimit("orders:track", 30, 15 * 60 * 1000);
    if (!rate.allowed) return fail("محاولات تتبع كثيرة، حاول لاحقاً", 429);
    const url = new URL(request.url);
    const orderNumber = (url.searchParams.get("orderNumber") || "").trim();
    const identifier = (url.searchParams.get("identifier") || "").trim().toLowerCase();
    if (!orderNumber || !identifier) return fail("رقم الطلب ووسيلة التحقق مطلوبة", 422);
    const [row] = await db.select({ order: orders, customer: users, store: stores }).from(orders).innerJoin(users, eq(orders.customerId, users.id)).innerJoin(stores, eq(orders.storeId, stores.id)).where(and(eq(orders.orderNumber, orderNumber), or(eq(users.email, identifier), eq(users.phone, identifier)))).limit(1);
    if (!row) return fail("لم يتم العثور على الطلب أو بيانات التحقق غير صحيحة", 404);
    const [shipments, history] = await Promise.all([
      db.select({ shipment: orderShipments, method: shippingMethods }).from(orderShipments).leftJoin(shippingMethods, eq(orderShipments.shippingMethodId, shippingMethods.id)).where(eq(orderShipments.orderId, row.order.id)),
      db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, row.order.id)).orderBy(asc(orderStatusHistory.createdAt))
    ]);
    const shipment = shipments[0];
    const coverage = normalizeShippingCoverage(shipment?.method?.coverageConfig);
    const deliveryAddress = (row.order.deliveryAddress || {}) as Record<string, unknown>;
    return ok({
      order: {
        id: row.order.id,
        orderNumber: row.order.orderNumber,
        statusCode: row.order.statusCode,
        statusLabel: orderStatusLabels[row.order.statusCode] || row.order.statusCode,
        nextStep: nextStep[row.order.statusCode] || "تابع تحديثات التاجر",
        paymentStatus: row.order.paymentStatus,
        paymentLabel: row.order.paymentStatus === "paid" ? "تم تأكيد الدفع" : "الدفع نقداً عند الاستلام أو بانتظار التأكيد",
        createdAt: row.order.createdAt,
        deliveredAt: row.order.deliveredAt
      },
      store: { name: row.store.name, slug: row.store.slug, contactPhone: row.store.contactPhone },
      delivery: {
        shippingMethodName: shipment?.method?.name || null,
        trackingNumber: shipment?.shipment.trackingNumber || null,
        courierName: shipment?.shipment.carrierName || coverage.courierName || null,
        courierPhone: coverage.courierPhone || null,
        estimatedDays: shipment?.method ? { min: shipment.method.estimatedDaysMin, max: shipment.method.estimatedDaysMax } : null,
        customerInstructions: coverage.customerInstructions || null,
        destination: [deliveryAddress.city, deliveryAddress.district, deliveryAddress.addressLine].filter(Boolean).join("، ") || null
      },
      history: history.map((item) => ({ ...item, statusLabel: orderStatusLabels[item.toStatus] || item.toStatus }))
    });
  } catch (error) {
    return handleApiError(error, "تعذر تتبع الطلب");
  }
}
