export const dynamic = "force-dynamic";

import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { AdFraudReviewPanel } from "@/components/admin/ad-fraud-review-panel";
import { adCampaigns, adFraudSignals, db, stores } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";

export default async function AdminAdsFraudPage() {
  const session = await requireAuth();
  await assertAdminOperation(session, "ads.fraud.view");
  const rows = await db.select({ signal: adFraudSignals, campaignName: adCampaigns.name, storeName: stores.name })
    .from(adFraudSignals).innerJoin(adCampaigns, eq(adFraudSignals.campaignId, adCampaigns.id)).innerJoin(stores, eq(adCampaigns.storeId, stores.id)).orderBy(desc(adFraudSignals.createdAt)).limit(300);
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-black">مراجعة جودة وFraud الإعلانات</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">اعتماد أو إبطال الإشارات مع سجل تدقيق. عند إبطال حدث مفوتر ينشئ النظام إشعار Credit مستقل ولا يحذف السجل المالي الأصلي.</p></div><Button asChild variant="outline"><Link href="/admin/ads-platform">العودة لمنصة الإعلانات</Link></Button></div><AdFraudReviewPanel rows={JSON.parse(JSON.stringify(rows))}/></section></main>;
}
