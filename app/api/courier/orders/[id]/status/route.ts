export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { fail, ok } from "@/lib/api";
import { db, orderShipments, orderStatusHistory, orders } from "@/lib/db";
import { checkIpRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const rate = await checkIpRateLimit("courier:update", 30, 15 * 60 * 1000);
    if (!rate.allowed) return fail("تم تجاوز حد تحديثات المندوب مؤقتاً", 429);

    const body = await request.json();
    const action = String(body.action || "").trim(); // "out_for_delivery" | "delivered" | "note"
    const note = String(body.note || "").trim();
    const courierPhone = String(body.courierPhone || "").trim();

    const [order] = await db.select().from(orders).where(eq(orders.id, params.id)).limit(1);
    if (!order) return fail("الطلب غير موجود", 404);

    let newStatus = order.status;
    let historyNote = note || "تحديث من مندوب التوصيل";

    if (action === "out_for_delivery") {
      newStatus = "shipped";
      historyNote = note || `المندوب استلم الشحنة وفي الطريق للتوصيل (${courierPhone || "بدون هاتف"})`;
    } else if (action === "delivered") {
      newStatus = "delivered";
      historyNote = note || "تم التسليم للعميل بنجاح بواسطة المندوب";
    }

    if (newStatus !== order.status) {
      await db.update(orders).set({ status: newStatus, updatedAt: new Date() }).where(eq(orders.id, order.id));
    }

    await db.insert(orderStatusHistory).values({
      orderId: order.id,
      status: newStatus,
      note: historyNote,
      createdAt: new Date()
    });

    const [shipment] = await db.select().from(orderShipments).where(eq(orderShipments.orderId, order.id)).limit(1);
    if (shipment && courierPhone) {
      await db.update(orderShipments).set({
        carrierName: shipment.carrierName || "مندوب التوصيل",
        status: newStatus,
        updatedAt: new Date()
      }).where(eq(orderShipments.id, shipment.id));
    }

    return ok({
      orderId: order.id,
      status: newStatus,
      message: "تم تحديث حالة التوصيل بنجاح، ووصل إشعار للعميل والتاجر."
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "تعذر تحديث حالة الطلب";
    return fail(msg, 500);
  }
}
