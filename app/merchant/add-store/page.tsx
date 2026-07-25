export const dynamic = "force-dynamic";
export const revalidate = 0;

import { and, asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { StoreApplicationForm } from "@/components/forms/store-application-form";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAuth } from "@/lib/auth";
import { cities, countries, db, districts, governorates, merchantApplications, stores } from "@/lib/db";
import { listActiveOnboardingWings } from "@/lib/onboarding/wing-template-assignment";

const openStatuses = ["new", "pending", "under_review", "waiting_for_data", "documents_required", "pre_approved", "contract_created", "contract_signed", "waiting_final_approval"] as const;

export default async function MerchantAddIndependentStorePage() {
  const session = await requireAuth();
  const [storeRows, openRows, wingItems, countryItems, governorateItems, cityItems, districtItems] = await Promise.all([
    db.select({ id: stores.id, name: stores.name, status: stores.status }).from(stores).where(eq(stores.merchantId, session.userId)).limit(20),
    db.select({ id: merchantApplications.id, storeName: merchantApplications.storeName, status: merchantApplications.status }).from(merchantApplications).where(and(eq(merchantApplications.applicantUserId, session.userId), eq(merchantApplications.applicationType, "independent_store"), inArray(merchantApplications.status, openStatuses))).limit(1),
    listActiveOnboardingWings(),
    db.select({ id: countries.id, name: countries.name }).from(countries).where(eq(countries.isActive, true)).orderBy(asc(countries.sortOrder), asc(countries.name)),
    db.select({ id: governorates.id, name: governorates.name, countryId: governorates.countryId }).from(governorates).where(eq(governorates.isActive, true)).orderBy(asc(governorates.sortOrder), asc(governorates.name)),
    db.select({ id: cities.id, name: cities.name, governorateId: cities.governorateId }).from(cities).where(eq(cities.isActive, true)).orderBy(asc(cities.sortOrder), asc(cities.name)),
    db.select({ id: districts.id, name: districts.name, cityId: districts.cityId }).from(districts).where(eq(districts.isActive, true)).orderBy(asc(districts.sortOrder), asc(districts.name))
  ]);
  const existingStore = storeRows[0] || null; const openApplication = openRows[0] || null;
  return <main className="min-h-screen merchant-aurora"><SiteHeader/><section className="container py-8 md:py-12"><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 inline-flex rounded-full bg-violet-100 px-4 py-2 text-xs font-black text-violet-800">Independent Activity / Multi-Store</div><h1 className="text-3xl font-black text-slate-950 md:text-5xl">إضافة متجر أو نشاط مستقل</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">افتح متجراً مستقلاً تحت نفس حسابك: عقد وكتالوج ومخزون وموظفون وفوترة وجاهزية مستقلة. لا يعامل كفرع إلا إذا كان تابعاً للنشاط نفسه.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/merchant/branches">إدارة الفروع</Link></Button><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div></div>{!existingStore ? <EmptyState title="يلزم وجود متجر أول" description="بعد اعتماد متجرك الأول وملف الهوية، يمكنك إضافة نشاط مستقل تحت الحساب نفسه." /> : openApplication ? <section className="rounded-3xl border bg-white p-8 text-center shadow-card"><h2 className="text-2xl font-black">لديك طلب نشاط مستقل قيد المعالجة</h2><p className="mt-3 text-sm text-slate-500">{openApplication.storeName} — الحالة: {openApplication.status}</p><Button asChild className="mt-5"><Link href={`/apply-store/${openApplication.id}`}>متابعة الطلب</Link></Button></section> : <StoreApplicationForm wings={wingItems} countries={countryItems} governorates={governorateItems} cities={cityItems} districts={districtItems} currentUser={{ fullName: session.fullName, email: session.email }} mode="independent_store" />}</section></main>;
}
