import { and, asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeCheck, ClipboardCheck, FileSignature, Store as StoreIcon } from "lucide-react";
import { StoreApplicationForm } from "@/components/forms/store-application-form";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth";
import { cities, countries, db, districts, governorates, merchantApplications, stores } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { listActiveOnboardingWings } from "@/lib/onboarding/wing-template-assignment";

export default async function ApplyStorePage() {
  const session = await getCurrentSession();
  let wingItems: Awaited<ReturnType<typeof listActiveOnboardingWings>> = [];
  let countryItems: Array<{ id: string; name: string }> = [];
  let governorateItems: Array<{ id: string; name: string; countryId: string }> = [];
  let cityItems: Array<{ id: string; name: string; governorateId: string }> = [];
  let districtItems: Array<{ id: string; name: string; cityId: string }> = [];
  let existingApplication: { id: string; storeName: string; status: string } | null = null;
  let existingStore: { id: string; name: string; slug: string; status: string } | null = null;

  if (hasDatabase()) {
    try {
      [wingItems, countryItems, governorateItems, cityItems, districtItems] = await Promise.all([
        listActiveOnboardingWings(),
        db.select({ id: countries.id, name: countries.name }).from(countries).where(eq(countries.isActive, true)).orderBy(asc(countries.sortOrder), asc(countries.name)),
        db.select({ id: governorates.id, name: governorates.name, countryId: governorates.countryId }).from(governorates).where(eq(governorates.isActive, true)).orderBy(asc(governorates.sortOrder), asc(governorates.name)),
        db.select({ id: cities.id, name: cities.name, governorateId: cities.governorateId }).from(cities).where(eq(cities.isActive, true)).orderBy(asc(cities.sortOrder), asc(cities.name)),
        db.select({ id: districts.id, name: districts.name, cityId: districts.cityId }).from(districts).where(eq(districts.isActive, true)).orderBy(asc(districts.sortOrder), asc(districts.name))
      ]);
      if (session) {
        const [storeRow] = await db.select({ id: stores.id, name: stores.name, slug: stores.slug, status: stores.status }).from(stores).where(eq(stores.merchantId, session.userId)).limit(1);
        existingStore = storeRow || null;
        const [applicationRow] = await db
          .select({ id: merchantApplications.id, storeName: merchantApplications.storeName, status: merchantApplications.status })
          .from(merchantApplications)
          .where(and(eq(merchantApplications.applicantUserId, session.userId), inArray(merchantApplications.status, ["new", "pending", "under_review", "waiting_for_data", "documents_required", "pre_approved", "contract_created", "contract_signed", "waiting_final_approval"])))
          .limit(1);
        existingApplication = applicationRow || null;
      }
    } catch (error) {
      console.error("Failed to load apply-store lookup data", error);
    }
  }

  return (
    <main className="onboarding-atelier relative min-h-screen overflow-hidden">
      <SiteHeader />
      <section className="container relative py-8 md:py-12">
        <div className="onboarding-hero relative mb-7 overflow-hidden rounded-[2rem] p-6 text-white md:mb-9 md:rounded-[2.25rem] md:p-8 lg:p-10">
          <div className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full border border-white/10" aria-hidden="true" />
          <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-blue-50 backdrop-blur">
                <BadgeCheck className="h-4 w-4 text-amber-300" /> رحلة تاجر موثقة وآمنة
              </div>
              <h1 className="text-3xl font-black leading-tight tracking-tight md:text-5xl">ابدأ متجرك بخطوات واضحة ومظهر احترافي.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-blue-50/80 md:text-base">أدخل بيانات نشاطك وموقعه التشغيلي، ثم تابع المراجعة والعقد والاعتماد من حسابك في مسار موثق لا يربكك.</p>
            </div>
            <Button asChild variant="outline" className="border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/20 hover:text-white">
              <Link href="/">العودة للرئيسية</Link>
            </Button>
          </div>
          <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
            <HeroFact icon={ClipboardCheck} title="بيانات منظمة" description="كل ما يحتاجه فريق المراجعة." />
            <HeroFact icon={FileSignature} title="عقد موثّق" description="يظهر فقط عند جاهزية الطلب." />
            <HeroFact icon={StoreIcon} title="تفعيل مدروس" description="بعد المراجعة والاعتماد النهائي." />
          </div>
        </div>

        {!session ? (
          <StateSurface title="يلزم تسجيل الدخول قبل تقديم الطلب" description="حتى تصلك تنبيهات إجراءات العقد ورقم العقد وقرارات الإدارة وبيانات الدخول، يجب أن يكون لديك حساب في المنصة أولاً. بعد التسجيل ستعود تلقائياً إلى صفحة الطلب لإكمال البيانات.">
            <Button asChild><Link href="/register?next=/apply-store">إنشاء حساب والمتابعة</Link></Button>
            <Button asChild variant="outline"><Link href="/login?next=/apply-store">لدي حساب — تسجيل الدخول</Link></Button>
          </StateSurface>
        ) : existingStore ? (
          <StateSurface title="لديك متجر مرتبط بهذا الحساب" description={`المتجر: ${existingStore.name} — الحالة: ${existingStore.status}. يمكنك إدارة المتجر، فتح فرع للنشاط نفسه، أو إضافة متجر/نشاط مستقل بعقد وكتالوج منفصلين.`}>
            <Button asChild><Link href="/merchant">لوحة التاجر</Link></Button>
            <Button asChild variant="outline"><Link href="/merchant/branches">فتح فرع تابع</Link></Button>
            <Button asChild variant="outline"><Link href="/merchant/add-store">إضافة نشاط مستقل</Link></Button>
            <Button asChild variant="outline"><Link href={`/store/${existingStore.slug}`}>معاينة المتجر</Link></Button>
          </StateSurface>
        ) : existingApplication ? (
          <StateSurface title="لديك طلب فتح متجر قيد المعالجة" description={`الطلب: ${existingApplication.storeName} — الحالة: ${existingApplication.status}. لا تحتاج لتقديم طلب جديد.`}>
            <Button asChild><Link href={`/apply-store/${existingApplication.id}`}>متابعة حالة الطلب</Link></Button>
            <Button asChild variant="outline"><Link href={`/apply-store/${existingApplication.id}/contract`}>صفحة العقد</Link></Button>
          </StateSurface>
        ) : (
          <StoreApplicationForm
            wings={wingItems}
            countries={countryItems}
            governorates={governorateItems}
            cities={cityItems}
            districts={districtItems}
            currentUser={{ fullName: session.fullName, email: session.email }}
          />
        )}
      </section>
    </main>
  );
}

function HeroFact({ icon: Icon, title, description }: { icon: typeof ClipboardCheck; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/15 p-4 backdrop-blur">
      <Icon className="mb-2 h-5 w-5 text-amber-300" />
      <p className="text-sm font-black">{title}</p>
      <p className="mt-1 text-xs leading-6 text-blue-50/70">{description}</p>
    </div>
  );
}

function StateSurface({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="onboarding-surface rounded-[2rem] p-7 text-center md:p-9">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-teal-600 text-white shadow-lg shadow-blue-600/20"><StoreIcon className="h-6 w-6" /></div>
      <h2 className="mt-5 text-2xl font-black text-slate-950">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">{children}</div>
    </div>
  );
}
