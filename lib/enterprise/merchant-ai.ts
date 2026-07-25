import { desc, eq, sql } from "drizzle-orm";
import { aiConversations, aiLogs, aiRecommendations, db, orders } from "@/lib/db";
import { getMerchantDashboardData } from "@/lib/merchant-dashboard";
import { getMerchantPrimaryStore } from "@/lib/db/queries";

export type MerchantAiRecommendation = {
  type: string;
  title: string;
  description: string;
  severity: "success" | "info" | "warning" | "danger";
  impactScore: number;
  actionUrl: string;
  data?: Record<string, unknown>;
};

export async function buildMerchantAiInsights(userId: string) {
  const dashboard = await getMerchantDashboardData(userId);
  if (!dashboard.store) return { store: null, dashboard, recommendations: [], customerInsights: null };
  const customerInsights = await getCustomerInsights(dashboard.store.id);
  const recommendations = generateRecommendations(dashboard, customerInsights);
  return { store: dashboard.store, dashboard, recommendations, customerInsights };
}

async function getCustomerInsights(storeId: string) {
  const [row] = await db
    .select({
      customers: sql<number>`count(distinct ${orders.customerId})::int`,
      orders: sql<number>`count(*)::int`,
      averageOrder: sql<string>`coalesce(avg(${orders.grandTotal}), 0)::text`,
      repeatCustomers: sql<number>`count(*) filter (where customer_orders.order_count > 1)::int`
    })
    .from(sql`(select ${orders.customerId} as customer_id, count(*) as order_count from ${orders} where ${orders.storeId} = ${storeId} group by ${orders.customerId}) customer_orders`)
    .leftJoin(orders, sql`${orders.customerId} = customer_orders.customer_id and ${orders.storeId} = ${storeId}`);
  return {
    customers: Number(row?.customers || 0),
    orders: Number(row?.orders || 0),
    averageOrder: Number(row?.averageOrder || 0),
    repeatCustomers: Number(row?.repeatCustomers || 0)
  };
}

function generateRecommendations(data: Awaited<ReturnType<typeof getMerchantDashboardData>>, customerInsights: Awaited<ReturnType<typeof getCustomerInsights>>): MerchantAiRecommendation[] {
  const recs: MerchantAiRecommendation[] = [];
  const topProduct = data.topProducts[0];
  const weakProduct = [...data.topProducts].reverse().find((product) => Number(product.soldCount || 0) === 0 || Number(product.viewCount || 0) < 5);

  if (topProduct) {
    recs.push({
      type: "best_product",
      title: `أفضل منتج حالياً: ${topProduct.name}`,
      description: `حقق ${topProduct.soldCount || 0} مبيع و ${topProduct.viewCount || 0} مشاهدة. ننصح بوضعه في إعلان ممول أو عرض Bundle مع منتج مكمل.`,
      severity: "success",
      impactScore: 92,
      actionUrl: "/merchant/ads",
      data: { productId: topProduct.id }
    });
  }

  if (weakProduct) {
    recs.push({
      type: "weak_product",
      title: `منتج يحتاج تحسين: ${weakProduct.name}`,
      description: "المؤشرات منخفضة. راجع الصورة الرئيسية، السعر، العنوان، والوصف التسويقي، ثم جرّب حملة قصيرة لاختبار الطلب.",
      severity: "warning",
      impactScore: 76,
      actionUrl: "/merchant/products",
      data: { productId: weakProduct.id }
    });
  }

  if (data.metrics.lowStock > 0) {
    recs.push({
      type: "inventory_risk",
      title: `${data.metrics.lowStock} منتجات أو متغيرات ستنفد قريباً`,
      description: "عزز المخزون قبل إطلاق أي حملة حتى لا تخسر الطلبات المدفوعة بسبب نفاد الكمية.",
      severity: "danger",
      impactScore: 88,
      actionUrl: "/merchant/inventory",
      data: { lowStock: data.lowStock.slice(0, 5) }
    });
  }

  if (data.metrics.activeProducts < Math.max(5, data.metrics.products * 0.5)) {
    recs.push({
      type: "catalog_depth",
      title: "كتالوجك يحتاج منتجات نشطة أكثر",
      description: "زيادة عدد المنتجات النشطة يحسن فرص الظهور في البحث ويزيد متوسط السلة. ابدأ بإكمال المسودات ونشر المنتجات الجاهزة.",
      severity: "info",
      impactScore: 70,
      actionUrl: "/merchant/products"
    });
  }

  if (customerInsights.customers > 0 && customerInsights.repeatCustomers / Math.max(customerInsights.customers, 1) < 0.2) {
    recs.push({
      type: "retention",
      title: "فرصة لتحسين عودة العملاء",
      description: "نسبة العملاء المتكررين منخفضة. جرّب كاش باك أو نقاط ولاء ورسائل متابعة بعد الشراء.",
      severity: "info",
      impactScore: 82,
      actionUrl: "/merchant/offers",
      data: customerInsights
    });
  }

  if (data.metrics.activePaymentMethods === 0 || data.metrics.activeShippingMethods === 0) {
    recs.push({
      type: "checkout_readiness",
      title: "أكمل إعدادات الدفع والشحن",
      description: "أي حملة أو ظهور بحث لن يحقق مبيعات إذا لم تكن طرق الدفع والشحن مفعلة بوضوح.",
      severity: "danger",
      impactScore: 95,
      actionUrl: "/merchant/operations-settings"
    });
  }

  return recs.sort((a, b) => b.impactScore - a.impactScore).slice(0, 8);
}

export function answerMerchantQuestion(question: string, insights: Awaited<ReturnType<typeof buildMerchantAiInsights>>) {
  const q = question.trim();
  const metrics = insights.dashboard.metrics;
  const recs = insights.recommendations.slice(0, 4);
  const profitEstimate = Math.round(metrics.salesTotal * 0.15);
  const lines = [
    `تحليل سريع لسؤالك: «${q}».`,
    `إجمالي مبيعاتك الحالية ${metrics.salesTotal.toLocaleString("ar")}، والربح التقديري التشغيلي قرابة ${profitEstimate.toLocaleString("ar")} بافتراض هامش 15%.`,
    `لزيادة المبيعات ركز على: ${recs.map((rec) => rec.title).join("، ") || "إضافة منتجات نشطة وتحسين الصور والأسعار"}.`,
    "أفضل إجراء الآن: عالج العناصر عالية التأثير أولاً ثم أطلق حملة ممولة قصيرة لقياس النتائج خلال 7 أيام."
  ];
  return lines.join("\n");
}

export async function persistMerchantAiChat(userId: string, question: string, answer: string) {
  const store = await getMerchantPrimaryStore(userId);
  const [conversation] = await db.insert(aiConversations).values({ storeId: store?.id || null, userId, title: question.slice(0, 180) || "محادثة مساعد التاجر" }).returning();
  await db.insert(aiLogs).values([
    { conversationId: conversation.id, storeId: store?.id || null, userId, role: "user", prompt: question, response: null },
    { conversationId: conversation.id, storeId: store?.id || null, userId, role: "assistant", prompt: question, response: answer, metadata: { source: "merchant_ai_assistant" } }
  ]);
  return conversation;
}

export async function saveRecommendations(storeId: string, recommendations: MerchantAiRecommendation[]) {
  if (!recommendations.length) return [];
  return db.insert(aiRecommendations).values(recommendations.map((rec) => ({ storeId, ...rec }))).returning();
}

export async function getRecentAiLogs(storeId: string) {
  return db.select().from(aiLogs).where(eq(aiLogs.storeId, storeId)).orderBy(desc(aiLogs.createdAt)).limit(20);
}

export function generateProductCopy(input: { baseName: string; category?: string; features?: string; audience?: string; tone?: string }) {
  const name = input.baseName.trim();
  const category = input.category || "منتج مميز";
  const features = input.features || "جودة عالية، تصميم عملي، قيمة ممتازة";
  const audience = input.audience || "عملاء المتجر";
  const tone = input.tone || "احترافي ومقنع";
  return {
    productName: `${name} - ${category} بجودة مختارة`,
    description: `اكتشف ${name} المصمم خصيصاً لـ ${audience}. يتميز بـ ${features}. صياغة العرض بأسلوب ${tone} تساعد العميل على فهم القيمة بسرعة وتشجعه على إتمام الشراء بثقة.`,
    seoTitle: `${name} | ${category} من صلاح سنتر`,
    metaDescription: `اشتر ${name} من أفضل المتاجر داخل صلاح سنتر. ${features}. توصيل وخيارات دفع مرنة.`,
    keywords: [name, category, "صلاح سنتر", "تسوق أونلاين", ...features.split(/[،,]/).map((x) => x.trim()).filter(Boolean)].slice(0, 12),
    tags: [category, "مميز", "الأكثر طلباً", "متوفر الآن"].filter(Boolean)
  };
}
