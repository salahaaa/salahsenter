export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { AdCampaignForm } from "@/components/merchant/ad-campaign-form";
import { AdInvoiceList } from "@/components/merchant/ad-invoice-list";
import { AdRecommendations } from "@/components/merchant/ad-recommendations";
import { AdCreativeExperimentPanel } from "@/components/merchant/ad-creative-experiment-panel";
import { AdCampaignActions } from "@/components/merchant/ad-campaign-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAuth } from "@/lib/auth";
import { adBilling, adCampaigns, adClicks, adImpressions, adInvoices, adOrderAttributions, db, products } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { getMerchantAdRecommendations } from "@/lib/ads/recommendations";
import { getMerchantCreativeVariantPerformance } from "@/lib/ads/creative-performance";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default async function MerchantAdsPage() {
  const session = await requireAuth();
  const store = await getMerchantPrimaryStore(session.userId);
  const [campaignRows, productRows, invoiceRows, recommendations, creativeVariants] = store ? await Promise.all([
    db.select({
      campaign: adCampaigns,
      impressions: sql<number>`(select count(*)::int from ${adImpressions} where ${adImpressions.campaignId} = ${adCampaigns.id})`,
      clicks: sql<number>`(select count(*)::int from ${adClicks} where ${adClicks.campaignId} = ${adCampaigns.id})`,
      conversions: sql<number>`(select count(*)::int from ${adOrderAttributions} where ${adOrderAttributions.campaignId} = ${adCampaigns.id} and ${adOrderAttributions.status} = 'delivered')`,
      attributedRevenue: sql<number>`(select coalesce(sum(${adOrderAttributions.conversionValue}), 0)::float from ${adOrderAttributions} where ${adOrderAttributions.campaignId} = ${adCampaigns.id} and ${adOrderAttributions.status} = 'delivered')`,
      dailySpend: sql<number>`(select coalesce(sum(${adBilling.amount}), 0)::float from ${adBilling} where ${adBilling.campaignId} = ${adCampaigns.id} and ${adBilling.status} in ('accrued', 'invoiced', 'paid') and ${adBilling.createdAt} >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')`
    }).from(adCampaigns).where(eq(adCampaigns.storeId, store.id)).orderBy(desc(adCampaigns.createdAt)),
    db.select({ id: products.id, name: products.name }).from(products).where(eq(products.storeId, store.id)).orderBy(desc(products.createdAt)).limit(200),
    db.select().from(adInvoices).where(eq(adInvoices.storeId, store.id)).orderBy(desc(adInvoices.createdAt)).limit(100),
    getMerchantAdRecommendations(store.id),
    getMerchantCreativeVariantPerformance(store.id)
  ]) : [[], [], [], [], []];
  return <main className="min-h-screen merchant-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-black text-slate-950">منصة إعلانات المتجر</h1><p className="mt-2 text-sm text-slate-500">Sponsored Products, Featured Products, Homepage Banner, Category Banner.</p></div><Button asChild variant="outline"><Link href="/merchant/home-exposure-requests">طلب ظهور في الرئيسية</Link></Button><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div>{!store?<EmptyState title="لا يوجد متجر"/>:<><AdCampaignForm products={productRows} storeId={store.id}/><div className="mt-8 grid gap-4 md:grid-cols-3">{campaignRows.map(({ campaign, impressions, clicks, conversions, attributedRevenue, dailySpend }) => { const ctr=impressions?clicks/impressions*100:0; const cpc=clicks?Number(campaign.spentAmount||0)/clicks:0; const cvr=clicks?conversions/clicks*100:0; const roas=Number(campaign.spentAmount||0)>0?Number(attributedRevenue||0)/Number(campaign.spentAmount||0):0; return <Card key={campaign.id}><CardHeader><CardTitle className="text-lg">{campaign.name}</CardTitle></CardHeader><CardContent><Badge variant={campaign.status==='active'||campaign.status==='approved'?'success':campaign.status==='rejected'?'danger':'warning'}>{campaign.status}</Badge><AdCampaignActions id={campaign.id} status={campaign.status}/><div className="mt-4 grid grid-cols-2 gap-2 text-sm"><Metric label="Budget" value={formatCurrency(campaign.budget)} /><Metric label="Spent" value={formatCurrency(campaign.spentAmount)} /><Metric label="صرف اليوم" value={formatCurrency(Number(dailySpend || 0))} /><Metric label="Impressions" value={formatNumber(impressions)} /><Metric label="Clicks" value={formatNumber(clicks)} /><Metric label="CTR" value={`${formatNumber(ctr)}%`} /><Metric label="CPC" value={formatCurrency(cpc)} /><Metric label="CVR" value={`${formatNumber(cvr)}%`} /><Metric label="ROAS" value={`${formatNumber(roas)}x`} /><Metric label="إيراد منسوب" value={formatCurrency(Number(attributedRevenue || 0))} /><Metric label="Conversions" value={formatNumber(conversions)} /></div></CardContent></Card>})}</div><AdRecommendations items={recommendations} /><AdCreativeExperimentPanel variants={creativeVariants} /><AdInvoiceList invoices={invoiceRows} /></>}</section></main>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="font-black text-slate-950">{value}</p></div>}
