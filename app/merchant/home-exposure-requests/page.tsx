export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { HomeExposureRequestPanel } from "@/components/merchant/home-exposure-request-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAuth } from "@/lib/auth";
import { db, homeExposureRequests } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";

export default async function MerchantHomeExposureRequestsPage() {
  const session = await requireAuth(); const store = await getMerchantPrimaryStore(session.userId);
  const requests = store ? await db.select().from(homeExposureRequests).where(eq(homeExposureRequests.storeId, store.id)).orderBy(desc(homeExposureRequests.createdAt)).limit(100) : [];
  return <main className="min-h-screen merchant-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 inline-flex rounded-full bg-amber-100 px-4 py-2 text-xs font-black text-amber-900">Commercial Homepage Exposure</div><h1 className="text-3xl font-black text-slate-950">طلبات الظهور التجاري</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">اطلب مساحة مدفوعة في الرئيسية دون التأثير على ترتيبك العضوي. التسعير والموافقة والتفعيل تبقى تحت مراجعة الإدارة.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/merchant/ads">إعلانات المتجر</Link></Button><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div></div>{!store?<EmptyState title="لا يوجد متجر مرتبط بالحساب"/>:<HomeExposureRequestPanel initialRequests={JSON.parse(JSON.stringify(requests))}/>}</section></main>;
}
