export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SmartStoreSetupPanel } from "@/components/merchant/smart-store-setup-panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";

export default async function MerchantSmartSetupPage() {
  const session = await requireAuth();
  const store = await getMerchantPrimaryStore(session.userId);
  return (
    <main className="min-h-screen merchant-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="mb-3 inline-flex rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700">One Click Smart Store Setup</div>
            <h1 className="text-3xl font-black text-slate-950 md:text-5xl">الإعداد الذكي للمتجر</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">أنشئ تصميماً أولياً وأقساماً وبانرات ومنتجات تجريبية بنقرة واحدة، مع بقاء الإعداد التقليدي متاحاً بالكامل.</p>
          </div>
          <div className="flex gap-2"><Button asChild variant="outline"><Link href="/merchant/settings">الإعداد التقليدي</Link></Button><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div>
        </div>
        {!store ? <EmptyState title="لا يوجد متجر" /> : <SmartStoreSetupPanel store={{ name: store.name, slug: store.slug }} />}
      </section>
    </main>
  );
}
