export const dynamic = "force-dynamic";

import { and, eq, or } from "drizzle-orm";
import { fail, ok } from "@/lib/api";
import { db, orderShipments, orders, stores, users } from "@/lib/db";
import { checkIpRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const rate = await checkIpRateLimit("courier:lookup", 60, 15 * 60 * 1000);
    if (!rate.allowed) return fail("محاولات كثيرة، حاول بعد قليل", 429);
    const url = new URL(request.url);
    const orderNumber = (url.searchParams.get("orderNumber") || "").trim();
    const identifier = (url.searchParams.get("identifier") || "").trim().toLowerCase();
    if (!orderNumber || !identifier) return fail("رقم الطلب ووسيلة التحقق مطلوبة", 422);

    const [row] = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        grandTotal: orders.grandTotal,
        createdAt: orders.createdAt,
        customerName: users.fullName,
        customerPhone: users.phone,
        customerEmail: users.email,
        storeName: stores.name,
        storePhone: stores.contactPhone,
        storeId: stores.id,
        customerId: users.id
      })
      .from(orders)
      .innerJoin(users, eq(orders.customerId, users.id))
      .innerJoin(stores, eq(orders.storeId, stores.id))
      .where(and(eq(orders.orderNumber, orderNumber), or(eq(users.email, identifier), eq(users.phone, identifier))))
      .limit(1);

    if (!row) return fail("لم يتم العثور على الطلب؛ تحقق من رقم الطلب وهاتف العميل", 404);

    const [shipment] = await db
      .select()
      .from(orderShipments)
      .where(eq(orderShipments.orderId, row.id))
      .limit(1);

    return ok({
      order: row,
      shipment: shipment || {
        trackingNumber: null,
        carrierName: "مندوب التوصيل",
        status: row.status
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "تعذر استعلام الطلب للمندوب";
    return fail(msg, 500);
  }
}
