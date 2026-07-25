export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import nextDynamic from "next/dynamic";
import { asc, eq } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { MerchantSmartLaunchpad } from "@/components/merchant/merchant-smart-launchpad";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { HelpCard } from "@/components/ui/help-card";
import { requireAuth } from "@/lib/auth";
import { categories, db } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";

const SmartProductIntakePanel = nextDynamic(() => import("@/components/merchant/smart-product-intake-panel").then((module) => module.SmartProductIntakePanel), { loading: () => <div className="rounded-3xl border bg-white p-8 text-center text-sm font-bold text-slate-500">جارٍ تحميل استيراد المنتجات...</div> });
const ActivityTemplateSmartPanel = nextDynamic(() => import("@/components/merchant/activity-template-smart-panel").then((module) => module.ActivityTemplateSmartPanel), { loading: () => null });

export default async function MerchantSmartToolsPage() {
  const session = await requireAuth();
  const store = await getMerchantPrimaryStore(session.userId);
  const categoryItems = store ? await db.select({ id: categories.id, name: categories.name, code: categories.code, level: categories.level }).from(categories).where(eq(categories.storeId, store.id)).orderBy(asc(categories.code), asc(categories.sortOrder), asc(categories.name)) : [];
  return (
    <main className="min-h-screen merchant-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="mb-3 inline-flex rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700">Smart AI Tools</div>
            <h1 className="text-3xl font-black text-slate-950 md:text-5xl">الإضافات الذكية</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">قسم مستقل لإضافة المنتجات بطرق حديثة: صوت، Excel/CSV، باركود، وصورة AI. شاشة إضافة المنتجات التقليدية باقية كما هي.</p>
          </div>
          <div className="flex gap-2"><Button asChild variant="outline"><Link href="/merchant/products">الإضافة التقليدية</Link></Button><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div>
        </div>
        <MerchantSmartLaunchpad />
        <HelpCard className="mb-6" title="اختيار الطريقة المناسبة">
          <p><b>الإضافة التقليدية:</b> مناسبة عند إدخال منتج مهم بتفاصيل كاملة يدوياً.</p>
          <p><b>الإضافات الذكية:</b> مناسبة عند إدخال عدد كبير من المنتجات أو عندما تريد تقليل الكتابة اليدوية ثم مراجعة المسودات.</p>
        </HelpCard>
        {!store ? <EmptyState title="لا يوجد متجر" /> : <><ActivityTemplateSmartPanel /><SmartProductIntakePanel categories={categoryItems} /></>}
      </section>
    </main>
  );
}
