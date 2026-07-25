import { eq } from "drizzle-orm";
import { products, stores, storeOfferCollections, wings, db } from "@/lib/db";
import { getHomeVisibilityRules, type VisibilityContentType } from "@/lib/home-visibility";

export type VisibilitySimulationInput = { type: VisibilityContentType; id: string };

export async function simulateHomeVisibility(input: VisibilitySimulationInput) {
  const rules = await getHomeVisibilityRules();
  const reasons: string[] = [];
  const blockers: string[] = [];
  const affectedRules: string[] = [];

  const pinned = rules.pinnedContent.find((item) => item.type === input.type && item.id === input.id && item.enabled);
  if (pinned) {
    reasons.push("المحتوى مثبت من الأدمن ضمن قسم المحتوى المثبت.");
    affectedRules.push("pinnedContent");
  }

  if (input.type === "store") {
    const [store] = await db.select().from(stores).where(eq(stores.id, input.id)).limit(1);
    if (!store) blockers.push("المتجر غير موجود.");
    else {
      if (store.status !== "active" || !store.isActive) blockers.push("المتجر غير نشط أو غير مفعل.");
      if (Number(store.profileCompleteness || 0) < rules.fairness.activeStoreMinimumCompleteness) blockers.push(`اكتمال بيانات المتجر أقل من الحد الأدنى (${rules.fairness.activeStoreMinimumCompleteness}%).`);
      if (rules.stores.manualIds.includes(input.id)) { reasons.push("المتجر ضمن اختيارات الأدمن اليدوية."); affectedRules.push("stores.manualIds"); }
      reasons.push(`يتم ترتيب المتجر حسب أوزان: المبيعات ${rules.rankingWeights.sales}%، التقييمات ${rules.rankingWeights.ratings}%، النشاط ${rules.rankingWeights.activity}%، جودة البيانات ${rules.rankingWeights.dataQuality}%.`);
      affectedRules.push("rankingWeights", "fairness.maxStoresPerHall");
    }
  }

  if (input.type === "product") {
    const [product] = await db.select().from(products).where(eq(products.id, input.id)).limit(1);
    if (!product) blockers.push("المنتج غير موجود.");
    else {
      if (product.status !== "active") blockers.push("المنتج ليس نشطاً.");
      if (rules.products.onlyPromotedInHomepage && !product.isPromoted && !rules.products.manualIds.includes(input.id) && !pinned) blockers.push("إعداد الرئيسية يحصر المنتجات في الممولة فقط، وهذا المنتج غير ممول وغير مثبت.");
      if (rules.products.manualIds.includes(input.id)) { reasons.push("المنتج ضمن اختيارات الأدمن اليدوية."); affectedRules.push("products.manualIds"); }
      if (product.isPromoted) { reasons.push("المنتج مدعوم إعلانياً/مروج."); affectedRules.push("products.promoted"); }
      reasons.push(`يطبق حد أقصى ${rules.fairness.maxProductsPerStore} منتج لكل متجر لمنع الاحتكار.`);
      affectedRules.push("fairness.maxProductsPerStore", "rankingWeights");
    }
  }

  if (input.type === "offer") {
    const [offer] = await db.select().from(storeOfferCollections).where(eq(storeOfferCollections.id, input.id)).limit(1);
    if (!offer) blockers.push("العرض غير موجود.");
    else {
      if (rules.offers.onlyApproved && offer.status !== "approved") blockers.push("العروض المعروضة يجب أن تكون معتمدة.");
      if (offer.isPromoted) { reasons.push("العرض ممول وله أولوية حسب قاعدة الممول أولاً."); affectedRules.push("offers.promotedFirst"); }
      reasons.push(`يطبق حد أقصى ${rules.fairness.maxOffersPerStore} عروض لكل متجر.`);
      affectedRules.push("fairness.maxOffersPerStore");
    }
  }

  if (input.type === "wing") {
    const [wing] = await db.select().from(wings).where(eq(wings.id, input.id)).limit(1);
    if (!wing) blockers.push("الجناح غير موجود.");
    else {
      if (!wing.isActive) blockers.push("الجناح غير مفعل.");
      if (rules.wings.manualIds.includes(input.id)) { reasons.push("الجناح ضمن الاختيارات اليدوية."); affectedRules.push("wings.manualIds"); }
      reasons.push("الأجنحة تظهر بنظام دورات عرض وشريط متحرك مع رابط كل الأجنحة.");
      affectedRules.push("wings.rotationIntervalSeconds", "wings.marqueeEnabled");
    }
  }

  return {
    visible: blockers.length === 0,
    type: input.type,
    id: input.id,
    reasons,
    blockers,
    affectedRules: [...new Set(affectedRules)],
    rulesSnapshot: {
      mode: input.type === "store" ? rules.stores.mode : input.type === "product" ? rules.products.mode : input.type === "offer" ? "offers" : rules.wings.mode,
      fairness: rules.fairness,
      rankingWeights: rules.rankingWeights
    },
    generatedAt: new Date().toISOString()
  };
}
