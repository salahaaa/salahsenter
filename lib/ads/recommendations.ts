import { and, gte, eq } from "drizzle-orm";
import { adCampaigns, adReports, db } from "@/lib/db";

export type AdRecommendationInput = {
  bidAmount: number;
  dailyBudget: number;
  budget: number;
  spentAmount: number;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  invalidClicks: number;
};

export type AdRecommendation = {
  state: "insufficient_data" | "protect" | "scale" | "improve_relevance" | "maintain";
  recommendedBid: number;
  recommendedDailyBudget: number;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  guardrails: string[];
};

function money(value: number) { return Math.max(0, Math.round(value * 100) / 100); }

/** Explainable advisory only; it never mutates a campaign or restarts a paused one. */
export function recommendAdBidAndBudget(input: AdRecommendationInput): AdRecommendation {
  const impressions = Math.max(0, input.impressions);
  const clicks = Math.max(0, input.clicks);
  const conversions = Math.max(0, input.conversions);
  const spend = money(input.spend);
  const ctr = impressions ? (clicks / impressions) * 100 : 0;
  const cvr = clicks ? (conversions / clicks) * 100 : 0;
  const roas = spend ? input.revenue / spend : 0;
  const invalidRate = clicks + input.invalidClicks ? (input.invalidClicks / (clicks + input.invalidClicks)) * 100 : 0;
  const baseBid = money(input.bidAmount);
  const baseDaily = money(input.dailyBudget || input.budget);
  const reasons: string[] = [];
  const guardrails = ["هذه توصية قابلة للمراجعة وليست تغييراً تلقائياً.", "لا ترفع الميزانية فوق المتبقي من الميزانية الكلية أو سياسة الإنفاق المعتمدة."];

  if (impressions < 100 || clicks < 10) {
    reasons.push("لا توجد عينة كافية بعد (أقل من 100 ظهور أو 10 نقرات نظيفة).");
    return { state: "insufficient_data", recommendedBid: baseBid, recommendedDailyBudget: baseDaily, confidence: "low", reasons, guardrails };
  }
  if (invalidRate >= 8) {
    reasons.push(`نسبة النقرات غير الصالحة/المشبوهة مرتفعة (${invalidRate.toFixed(1)}%).`);
    guardrails.unshift("راجع إشارات جودة الزيارات قبل أي زيادة في السعر أو الميزانية.");
    return { state: "protect", recommendedBid: money(baseBid * 0.85), recommendedDailyBudget: money(baseDaily * 0.8), confidence: "medium", reasons, guardrails };
  }
  if (roas >= 3 && cvr >= 1.5 && ctr >= 1) {
    reasons.push(`الأداء متوازن: CTR ${ctr.toFixed(1)}%، CVR ${cvr.toFixed(1)}%، ROAS ${roas.toFixed(2)}x.`);
    return { state: "scale", recommendedBid: money(baseBid * 1.1), recommendedDailyBudget: money(baseDaily * 1.2), confidence: impressions >= 1_000 ? "high" : "medium", reasons, guardrails };
  }
  if (ctr < 0.7 || cvr < 0.7) {
    reasons.push(ctr < 0.7 ? `CTR منخفض (${ctr.toFixed(1)}%)؛ راجع الإبداع والموضع والكلمات المستهدفة.` : `CVR منخفض (${cvr.toFixed(1)}%)؛ راجع صلة المنتج والسعر وصفحة المنتج.`);
    return { state: "improve_relevance", recommendedBid: money(baseBid * 0.9), recommendedDailyBudget: money(baseDaily * 0.9), confidence: "medium", reasons, guardrails };
  }
  reasons.push("المؤشرات ضمن نطاق مستقر ولا تبرر تغييراً حاداً في السعر أو الميزانية.");
  return { state: "maintain", recommendedBid: baseBid, recommendedDailyBudget: baseDaily, confidence: "medium", reasons, guardrails };
}

export async function getMerchantAdRecommendations(storeId: string, days = 7) {
  const since = new Date(Date.now() - Math.max(1, Math.min(days, 30)) * 24 * 60 * 60 * 1000);
  const [campaigns, reports] = await Promise.all([
    db.select().from(adCampaigns).where(eq(adCampaigns.storeId, storeId)),
    db.select().from(adReports).where(and(eq(adReports.storeId, storeId), gte(adReports.reportDate, since)))
  ]);
  const metrics = new Map<string, { impressions: number; clicks: number; conversions: number; spend: number; revenue: number; invalidClicks: number }>();
  for (const report of reports) {
    const current = metrics.get(report.campaignId) || { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0, invalidClicks: 0 };
    current.impressions += Number(report.impressions || 0);
    current.clicks += Number(report.clicks || 0);
    current.conversions += Number(report.conversions || 0);
    current.spend += Number(report.spend || 0);
    current.revenue += Number(report.revenue || 0);
    current.invalidClicks += Number(report.invalidClicks || 0);
    metrics.set(report.campaignId, current);
  }
  return campaigns.map((campaign) => ({
    campaignId: campaign.id,
    campaignName: campaign.name,
    status: campaign.status,
    placementId: campaign.placementId,
    billingModel: campaign.billingModel,
    recommendation: recommendAdBidAndBudget({
      bidAmount: Number(campaign.bidAmount || 0), dailyBudget: Number(campaign.dailyBudget || 0), budget: Number(campaign.budget || 0), spentAmount: Number(campaign.spentAmount || 0),
      ...(metrics.get(campaign.id) || { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0, invalidClicks: 0 })
    })
  }));
}
