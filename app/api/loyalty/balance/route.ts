export const dynamic = "force-dynamic";

import { eq, sql } from "drizzle-orm";
import { fail, ok } from "@/lib/api";
import { getCurrentSession } from "@/lib/auth";
import { db, orders, users } from "@/lib/db";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session?.userId) return fail("يجب تسجيل الدخول لعرض رصيد الولاء", 401);

    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user) return fail("المستخدم غير موجود", 404);

    const [ordersSummary] = await db
      .select({
        totalSpent: sql<number>`coalesce(sum(${orders.grandTotal}), 0)::int`,
        ordersCount: sql<number>`count(*)::int`
      })
      .from(orders)
      .where(eq(orders.customerId, user.id));

    const totalSpent = Number(ordersSummary?.totalSpent || 0);
    const totalOrders = Number(ordersSummary?.ordersCount || 0);

    // 1 point per 1,000 YER spent + 100 welcome points
    const points = Math.floor(totalSpent / 1000) + 100;
    const tier = points >= 1000 ? "platinum" : points >= 500 ? "gold" : "silver";
    const tierLabel = tier === "platinum" ? "بلاتيني (VIP)" : tier === "gold" ? "ذهبي" : "فضي";
    const nextTierPoints = tier === "platinum" ? 0 : tier === "gold" ? 1000 - points : 500 - points;

    return ok({
      userId: user.id,
      fullName: user.fullName,
      points,
      totalSpent,
      totalOrders,
      tier,
      tierLabel,
      nextTierPoints,
      availableCoupons: [
        { code: "LOYALTY10", title: "خصم 10% لعملاء الولاء", minPoints: 200, discountValue: "10%" },
        { code: "LOYALTY2500", title: "قسيمة خصم 2,500 ريال", minPoints: 500, discountValue: "2,500 YER" },
        { code: "LOYALTYVIP50", title: "خصم كبار العملاء VIP 20%", minPoints: 1000, discountValue: "20%" }
      ]
    });
  } catch (error) {
    return fail("تعذر قراءة رصيد الولاء", 500);
  }
}
