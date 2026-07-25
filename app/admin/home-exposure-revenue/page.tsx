export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { HomeExposureRevenuePanel } from "@/components/admin/home-exposure-revenue-panel";
import { HomeExposureRequestReviewPanel } from "@/components/admin/home-exposure-request-review-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { db, homeExposureRequests, stores } from "@/lib/db";
import { getHomeExposureAdminSnapshot } from "@/lib/home-exposure";
import { assertAdmin } from "@/lib/rbac";

export default async function HomeExposureRevenuePage() {
  const session = await requireAuth();
  await assertAdmin(session, "ads.manage");
  await assertAdmin(session, "home.manage");
  const [snapshot, storeRows, requestRows] = await Promise.all([
    getHomeExposureAdminSnapshot(),
    db.select({ id: stores.id, name: stores.name, slug: stores.slug }).from(stores).where(eq(stores.isActive, true)).orderBy(asc(stores.name)).limit(500),
    db.select({ request: homeExposureRequests, storeName: stores.name, storeSlug: stores.slug }).from(homeExposureRequests).innerJoin(stores, eq(homeExposureRequests.storeId, stores.id)).orderBy(desc(homeExposureRequests.createdAt)).limit(300)
  ]);
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 inline-flex rounded-full bg-amber-100 px-4 py-2 text-xs font-black text-amber-900">Dynamic Homepage Exposure & Revenue Engine</div><h1 className="text-3xl font-black text-slate-950 md:text-5xl">محرك الظهور والإيرادات للرئيسية</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">مركز مستقل للجدولة والتدوير والحدود والعدالة والإيراد الإعلاني. قواعد ظهور الرئيسية تبقى للمحتوى العضوي فقط، وكل ظهور تجاري موسوم بوضوح.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/admin/home-visibility">القواعد العضوية</Link></Button><Button asChild variant="outline"><Link href="/admin/ads">منصة الإعلانات</Link></Button><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div></div><div className="space-y-8"><HomeExposureRequestReviewPanel initialRows={JSON.parse(JSON.stringify(requestRows))}/><HomeExposureRevenuePanel stores={JSON.parse(JSON.stringify(storeRows))} initialCampaigns={JSON.parse(JSON.stringify(snapshot.campaigns))} initialSettings={JSON.parse(JSON.stringify(snapshot.settings))}/></div></section></main>;
}
