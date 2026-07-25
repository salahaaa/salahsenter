export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { AdCampaignAdminActions } from "@/components/admin/ad-campaign-admin-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { adCampaigns, adClicks, adImpressions, adOrderAttributions, db, stores } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default async function AdminAdsPlatformPage() {
  const session = await requireAuth();
  await assertAdminOperation(session, "ads.view");
  const campaigns = await db.select({
    campaign: adCampaigns,
    storeName: stores.name,
    clicks: sql<number>`(select count(*)::int from ${adClicks} where ${adClicks.campaignId} = ${adCampaigns.id})`,
    impressions: sql<number>`(select count(*)::int from ${adImpressions} where ${adImpressions.campaignId} = ${adCampaigns.id})`,
    conversions: sql<number>`(select count(*)::int from ${adOrderAttributions} where ${adOrderAttributions.campaignId} = ${adCampaigns.id} and ${adOrderAttributions.status} = 'delivered')`,
    attributedRevenue: sql<number>`(select coalesce(sum(${adOrderAttributions.conversionValue}), 0)::float from ${adOrderAttributions} where ${adOrderAttributions.campaignId} = ${adCampaigns.id} and ${adOrderAttributions.status} = 'delivered')`
  }).from(adCampaigns).innerJoin(stores, eq(adCampaigns.storeId, stores.id)).orderBy(desc(adCampaigns.createdAt)).limit(200);
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-black text-slate-950">منصة الإعلانات الداخلية</h1><p className="mt-2 text-sm text-slate-500">إدارة الحملات، الموافقات، الفوترة ومؤشرات الأداء.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/admin/ads-platform/billing">فواتير الإعلانات</Link></Button><Button asChild variant="outline"><Link href="/admin/ads-platform/fraud">جودة وFraud</Link></Button><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div></div><div className="grid gap-4 md:grid-cols-3">{campaigns.map(({campaign,storeName,clicks,impressions,conversions,attributedRevenue})=>{const ctr=impressions?clicks/impressions*100:0;const cvr=clicks?conversions/clicks*100:0;const roas=Number(campaign.spentAmount||0)>0?Number(attributedRevenue||0)/Number(campaign.spentAmount||0):0;return <Card key={campaign.id}><CardHeader><CardTitle>{campaign.name}</CardTitle><p className="text-sm text-slate-500">{storeName} • {campaign.type}</p></CardHeader><CardContent className="space-y-4"><AdCampaignAdminActions id={campaign.id} status={campaign.status} type={campaign.type} publishedBannerId={typeof (campaign.creative as Record<string, unknown>)?.publishedBannerId === "string" ? String((campaign.creative as Record<string, unknown>).publishedBannerId) : null}/><div className="grid grid-cols-2 gap-2"><Metric label="Budget" value={formatCurrency(campaign.budget)}/><Metric label="Spent" value={formatCurrency(campaign.spentAmount)}/><Metric label="Impressions" value={formatNumber(impressions)}/><Metric label="Clicks" value={formatNumber(clicks)}/><Metric label="CTR" value={`${formatNumber(ctr)}%`}/><Metric label="CVR" value={`${formatNumber(cvr)}%`}/><Metric label="ROAS" value={`${formatNumber(roas)}x`}/><Metric label="إيراد منسوب" value={formatCurrency(Number(attributedRevenue||0))}/><Metric label="Bid" value={formatCurrency(campaign.bidAmount)}/></div></CardContent></Card>})}</div></section></main>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="font-black text-slate-950">{value}</p></div>}
