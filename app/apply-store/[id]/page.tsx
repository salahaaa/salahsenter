import Link from "next/link";
import { eq } from "drizzle-orm";
import { Bell, FileSignature, Store } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApplicationFlowTimeline } from "@/components/applications/application-flow-timeline";
import { nextApplicationHint, statusLabels } from "@/lib/application-flow";
import { cities, countries, db, districts, governorates, merchantApplicationArchives, merchantApplications } from "@/lib/db";
import { getMerchantApplicationDocuments } from "@/lib/onboarding/merchant-application-documents";
import { MerchantApplicationDocumentsPanel } from "@/components/applications/merchant-application-documents-panel";
import { MerchantApplicationRevisionForm } from "@/components/applications/merchant-application-revision-form";
import { getCurrentSession, hasRole } from "@/lib/auth";
import { listActiveOnboardingWings } from "@/lib/onboarding/wing-template-assignment";

const contractReadyStatuses = ["contract_created", "contract_signed", "waiting_final_approval", "approved", "active"];

export default async function ApplicationStatusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [application] = await db.select().from(merchantApplications).where(eq(merchantApplications.id, id)).limit(1);
  const session = await getCurrentSession();

  if (!application) {
    return <main className="onboarding-atelier relative min-h-screen"><SiteHeader /><section className="container py-10"><h1 className="text-2xl font-black">طلب فتح المتجر غير موجود</h1></section></main>;
  }

  const canAccess = Boolean((session && hasRole(session, "super_admin")) || (session?.userId && application.applicantUserId === session.userId));
  if (!canAccess) {
    return (
      <main className="onboarding-atelier relative min-h-screen">
        <SiteHeader />
        <section className="container py-10">
          <div className="rounded-[2rem] border bg-white p-8 text-center shadow-card">
            <h1 className="text-2xl font-black text-slate-950">لا تملك صلاحية عرض هذا الطلب</h1>
            <p className="mt-3 text-sm leading-7 text-slate-500">سجّل الدخول بالحساب الذي قدم الطلب أو بحساب أدمن.</p>
            <Button asChild className="mt-6"><Link href={`/login?next=/apply-store/${id}`}>تسجيل الدخول</Link></Button>
          </div>
        </section>
      </main>
    );
  }

  const contractReady = contractReadyStatuses.includes(application.status);
  const activated = ["approved", "active"].includes(application.status);
  const [documentsData, archives, wingItems, countryItems, governorateItems, cityItems, districtItems] = await Promise.all([
    getMerchantApplicationDocuments(application.id),
    db.select().from(merchantApplicationArchives).where(eq(merchantApplicationArchives.applicationId, application.id)),
    listActiveOnboardingWings(),
    db.select({ id: countries.id, name: countries.name }).from(countries).where(eq(countries.isActive, true)),
    db.select({ id: governorates.id, name: governorates.name, countryId: governorates.countryId }).from(governorates).where(eq(governorates.isActive, true)),
    db.select({ id: cities.id, name: cities.name, governorateId: cities.governorateId }).from(cities).where(eq(cities.isActive, true)),
    db.select({ id: districts.id, name: districts.name, cityId: districts.cityId }).from(districts).where(eq(districts.isActive, true))
  ]);

  const selectedWing = wingItems.find((wing) => wing.id === application.wingId);

  return (
    <main className="onboarding-atelier relative min-h-screen">
      <SiteHeader />
      <section className="container space-y-6 py-8">
        <div className="overflow-hidden rounded-[2rem] border bg-white p-6 shadow-card md:p-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="text-right">
              <Badge className="mb-4 bg-blue-50 text-blue-700"><Store className="ml-1 h-4 w-4" /> طلب فتح متجر</Badge>
              <h1 className="text-3xl font-black text-slate-950 md:text-5xl">{application.storeName}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">{nextApplicationHint(application.status)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {contractReady ? <Button asChild><Link href={`/apply-store/${application.id}/contract`}><FileSignature className="h-4 w-4" /> فتح العقد</Link></Button> : null}
              {activated ? <Button asChild variant="secondary"><Link href="/merchant">لوحة التاجر</Link></Button> : null}
              <Button asChild variant="outline"><Link href="/notifications"><Bell className="h-4 w-4" /> التنبيهات</Link></Button>
            </div>
          </div>
        </div>

        <ApplicationFlowTimeline status={application.status} />

        {application.status === "waiting_for_data" ? <MerchantApplicationRevisionForm application={{ id: application.id, applicantName: application.applicantName, applicantPhone: application.applicantPhone, storeName: application.storeName, businessActivity: application.businessActivity, description: application.description, socialLinks: application.socialLinks, wingId: application.wingId, countryId: application.countryId, governorateId: application.governorateId, cityId: application.cityId, districtId: application.districtId }} wings={wingItems} countries={countryItems} governorates={governorateItems} cities={cityItems} districts={districtItems} /> : null}
        <MerchantApplicationDocumentsPanel applicationId={application.id} rows={documentsData.requirements as any[]} enabled={["documents_required", "under_review", "waiting_for_data"].includes(application.status)} />
        {archives.length ? <section className="rounded-[2rem] border bg-white p-6 shadow-card"><h2 className="text-xl font-black text-slate-950">أرشيف PDF المحلي</h2><div className="mt-4 flex flex-wrap gap-3">{archives.map((archive) => archive.status === "ready" && archive.url ? <Button key={archive.id} asChild variant="outline"><a href={archive.url?.startsWith("private-r2://") ? `/api/merchant-applications/${application.id}/archives/${archive.id}/download` : archive.url} target="_blank">{archive.kind === "signed_contract_pdf" ? "تحميل العقد الموقّع PDF" : "تحميل فهرس الوثائق PDF"}</a></Button> : <span key={archive.id} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">{archive.kind}: {archive.status}</span>)}</div></section> : null}
        <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <section className="rounded-[2rem] border bg-white p-6 shadow-card">
            <h2 className="text-xl font-black text-slate-950">بيانات الطلب</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <Row label="الحالة" value={statusLabels[application.status as keyof typeof statusLabels] || application.status} />
              <Row label="مقدم الطلب" value={application.applicantName} />
              <Row label="البريد" value={application.applicantEmail} />
              <Row label="الهاتف" value={application.applicantPhone || "-"} />
              <Row label="وصف النشاط" value={application.businessActivity} />
              <Row label="الجناح / القطاع" value={selectedWing?.name || "لم يُحدد أو لم يعد نشطاً (طلب قديم)"} />
              <Row label="تاريخ الطلب" value={new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(application.createdAt)} />
              <Row label="ملاحظة الإدارة" value={application.adminNote || "لا توجد ملاحظات"} />
            </dl>
          </section>
          <section className="rounded-[2rem] border bg-white p-6 shadow-card">
            <h2 className="text-xl font-black text-slate-950">الخطوة التالية</h2>
            <p className="mt-3 text-sm leading-8 text-slate-600">{nextApplicationHint(application.status)}</p>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
              <p className="font-black text-slate-900">ملاحظات مهمة:</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>العقد لا يظهر للتوقيع إلا بعد إرساله من الإدارة.</li>
                <li>توقيع العقد لا يفعّل المتجر مباشرة؛ يجب انتظار الموافقة النهائية.</li>
                <li>بعد التفعيل يمكنك الدخول للوحة التاجر واستكمال الصور والمنتجات ووسائل الدفع.</li>
              </ul>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3"><dt className="font-bold text-slate-500">{label}</dt><dd className="text-left font-black text-slate-800">{value}</dd></div>;
}
