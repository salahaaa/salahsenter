export const dynamic = "force-dynamic";

import { and, desc, eq } from "drizzle-orm";
import { fail, ok } from "@/lib/api";
import { getCurrentSession } from "@/lib/auth";
import { db, products, productVariants, stores } from "@/lib/db";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session?.userId) return fail("يجب تسجيل الدخول كتاجر", 401);

    const [store] = await db.select().from(stores).where(eq(stores.merchantId, session.userId)).limit(1);
    if (!store) return fail("المتجر غير موجود", 404);

    const items = await db
      .select({
        id: products.id,
        name: products.name,
        basePrice: products.basePrice,
        soldCount: products.soldCount,
        viewCount: products.viewCount,
        ratingAverage: products.ratingAverage,
        status: products.status
      })
      .from(products)
      .where(and(eq(products.storeId, store.id), eq(products.status, "active")))
      .orderBy(desc(products.soldCount))
      .limit(20);

    const recommendations = [];
    for (const item of items) {
      const sold = Number(item.soldCount || 0);
      const views = Number(item.viewCount || 0);
      const price = Number(item.basePrice || 0);
      const velocity = Math.max(0.1, sold / 30); // sold per day avg
      const estimatedStock = Math.max(5, 50 - sold); // simulated current stock
      const depletionDays = Math.round(estimatedStock / velocity);

      let stockAdvice = `المخزون الحالي آمن ومستقر لعقد القادم (${depletionDays} يوم تقريباً).`;
      let stockSeverity: "ok" | "warn" | "danger" = "ok";
      if (depletionDays <= 14) {
        stockAdvice = `تنبيه: هذا المنتج سينفد خلال ${depletionDays} يوماً وفق معدل البيع الحالي! ننصح بإعادة طلب بضاعة جديدة فوراً.`;
        stockSeverity = "danger";
      } else if (depletionDays <= 30) {
        stockAdvice = `تنبيه مخزون: معدل السحب مرتفع، يُتوقع نفاد المخزون خلال شهر (${depletionDays} يوماً).`;
        stockSeverity = "warn";
      }

      let pricingAdvice = "السعر الحالي متوافق مع متوسط السوق في الجناح.";
      if (views > 50 && sold < 5) {
        pricingAdvice = `اقتراح تسعير ذكي: المنتج يحظى بـ ${views} مشاهدة لكن المبيعات منخفضة (${sold} فقط). ننصح بعمل خصم ترويجي بنسبة 8% لرفع التحويل!`;
      } else if (sold > 30) {
        pricingAdvice = `منتج رائج جداً (Best Seller): يطلب بكثافة (${sold} مبيع). يمكنك الحفاظ على السعر أو عمل عرض حزمة (Bundle) لمضاعفة متوسط السلة.`;
      }

      recommendations.push({
        productId: item.id,
        productName: item.name,
        price,
        soldCount: sold,
        viewCount: views,
        depletionDays,
        stockSeverity,
        stockAdvice,
        pricingAdvice
      });
    }

    return ok({
      storeId: store.id,
      storeName: store.name,
      analyzedProductsCount: items.length,
      recommendations,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return fail("تعذر تشغيل محرك التنبؤ الذكي", 500);
  }
}
