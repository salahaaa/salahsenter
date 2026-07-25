import Link from "next/link";
import { eq } from "drizzle-orm";
import { MerchantApplicationActions } from "@/components/admin/merchant-application-actions";
import { MerchantApplicationReviewActions } from "@/components/admin/merchant-application-review-actions";
import { ApplicationAiSummary } from "@/components/admin/application-ai-summary";
import { ApplicationFlowTimeline } from "@/components/applications/application-flow-timeline";
import { nextApplicationHint } from "@/lib/application-flow";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db, merchantApplicationArchives, merchantApplications, wings, countries, governorates, cities, districts } from "@/lib/db";
import { getMerchantApplicationDocuments } from "@/lib/onboarding/merchant-application-documents";
import { MerchantApplicationDocumentReviewPanel } from "@/components/admin/merchant-application-document-review-panel";
import { MerchantApplicationArchiveActions } from "@/components/admin/merchant-application-archive-actions";
import { AdminAiLens } from "@/components/admin/admin-ai-lens";
import { buildDefaultContract } from "@/lib/contracts";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

const statusLabels: Record<string, string> = {
  new: "جديد",
  pending: "قيد التقديم",
  under_review: "قيد المراجعة",
  waiting_for_data: "بانتظار استكمال البيانات",
  documents_required: "مطلوب مستندات",
  pre_approved: "قبول مبدئي",
  contract_created: "تم إنشاء العقد",
  contract_signed: "تم توقيع العقد",
  waiting_final_approval: "بانتظار الموافقة النهائية من الأدمن",
  approved: "معتمد",
  active: "مفعل",
  rejected: "مرفوض"
};

export default async function MerchantApplicationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  await assertAdmin(session, "merchant_applications.manage");
  const { id } = await params;
  const [application] = await db
    .select({
      app: merchantApplications,
      wingName: wings.name,
      countryName: countries.name,
      governorateName: governorates.name,
      cityName: cities.name,
      districtName: districts.name
    })
    .from(merchantApplications)
    .leftJoin(wings, eq(merchantApplications.wingId, wings.id))
    .leftJoin(countries, eq(merchantApplications.countryId, countries.id))
    .leftJoin(governorates, eq(merchantApplications.governorateId, governorates.id))
    .leftJoin(cities, eq(merchantApplications.cityId, cities.id))
    .leftJoin(districts, eq(merchantApplications.districtId, districts.id))
    .where(eq(merchantApplications.id, id))
    .limit(1);

  if (!application) {
    return <main className="min-h-screen admin-aurora"><SiteHeader /><section className="container py-8"><h1 className="text-2xl font-black">الطلب غير موجود</h1></section></main>;
  }

  const app = application.app;
  const [documentsData, archives] = await Promise.all([
    getMerchantApplicationDocuments(app.id),
    db.select().from(merchantApplicationArchives).where(eq(merchantApplicationArchives.applicationId, app.id))
  ]);
  const contractBody = app.contractBody || buildDefaultContract(app);

  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-black text-slate-950">مراجعة طلب فتح المتجر</h1>
            <p className="mt-2 text-sm text-slate-500">راجع البيانات والعقد والتوقيع قبل الموافقة النهائية.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/admin/merchant-applications">العودة</Link></Button>
            <Button asChild variant="outline"><Link href={`/apply-store/${app.id}`}>صفحة متابعة العميل</Link></Button>
            <MerchantApplicationActions id={app.id} status={app.status} />
          </div>
        </div>

        <div className="mb-6 space-y-6">
          <ApplicationFlowTimeline status={app.status} />
          <ApplicationAiSummary applicationId={app.id} />
          <AdminAiLens kind="onboarding" id={app.id} />
          <div className="rounded-3xl border bg-white p-5 shadow-card">
            <h2 className="mb-2 text-lg font-black text-slate-950">إجراءات المراجعة الإدارية</h2>
            <p className="mb-4 text-sm leading-7 text-slate-500">{nextApplicationHint(app.status)}</p>
            <MerchantApplicationReviewActions id={app.id} status={app.status} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border bg-white p-6 shadow-card">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-black text-slate-950">{app.storeName}</h2>
                <Badge variant={app.status === "waiting_final_approval" ? "warning" : app.status === "approved" ? "success" : "outline"}>{statusLabels[app.status]}</Badge>
              </div>
              <dl className="mt-5 space-y-3 text-sm">
                <Row label="مقدم الطلب" value={app.applicantName} />
                <Row label="البريد" value={app.applicantEmail} />
                <Row label="الهاتف" value={app.applicantPhone || "-"} />
                <Row label="النشاط" value={app.businessActivity} />
                <Row label="الجناح" value={application.wingName || "-"} />
                <Row label="الموقع" value={[application.countryName, application.governorateName, application.cityName, application.districtName].filter(Boolean).join("، ") || "-"} />
                <Row label="تاريخ الطلب" value={new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(app.createdAt)} />
                <Row label="تاريخ توقيع العقد" value={app.contractAcceptedAt ? new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(app.contractAcceptedAt) : "لم يوقّع بعد"} />
              </dl>
            </section>

            <MerchantApplicationDocumentReviewPanel applicationId={app.id} rows={documentsData.requirements as any[]} />
            <section className="rounded-3xl border bg-white p-6 shadow-card"><h2 className="text-xl font-black text-slate-950">أرشيف PDF</h2>{!archives.length ? <p className="mt-4 text-sm text-slate-500">لا يوجد أرشيف PDF مولد بعد.</p> : <div className="mt-4 space-y-3">{archives.map((archive) => <div key={archive.id} className="rounded-2xl border bg-slate-50 p-3 text-sm font-bold">{archive.status === "ready" && archive.url ? <a href={archive.url.startsWith("private-r2://") ? `/api/merchant-applications/${app.id}/archives/${archive.id}/download` : archive.url} target="_blank" className="text-primary" rel="noreferrer">{archive.kind} — PDF محفوظ محلياً</a> : <span className="text-amber-800">{archive.kind}: {archive.status}</span>}{["signed_contract_pdf", "documents_manifest_pdf"].includes(archive.kind) ? <MerchantApplicationArchiveActions applicationId={app.id} kind={archive.kind as "signed_contract_pdf" | "documents_manifest_pdf"} status={archive.status} /> : null}</div>)}</div>}</section>

            <section className="rounded-3xl border bg-white p-6 shadow-card">
              <h2 className="text-xl font-black text-slate-950">التوقيع الإلكتروني</h2>
              {app.contractSignatureDataUrl ? <img src={app.contractSignatureDataUrl.startsWith("private-r2://") ? `/api/merchant-applications/${app.id}/signature` : app.contractSignatureDataUrl} alt="التوقيع الإلكتروني" className="mt-4 rounded-2xl border bg-slate-50 p-3" /> : <p className="mt-4 text-sm text-slate-500">لم يتم توقيع العقد بعد.</p>}
            </section>

            <section className="rounded-3xl border bg-white p-6 shadow-card">
              <h2 className="text-xl font-black text-slate-950">نسخة العقد الموقّع</h2>
              {app.signedContractSnapshot ? <pre className="mt-4 max-h-80 overflow-auto rounded-2xl bg-slate-50 p-4 text-xs leading-6 text-slate-600">{JSON.stringify(app.signedContractSnapshot, null, 2)}</pre> : <p className="mt-4 text-sm text-slate-500">ستظهر نسخة العقد الموقّع هنا بعد توقيع التاجر.</p>}
            </section>
          </div>

          <section className="rounded-3xl border bg-white p-6 shadow-card">
            <h2 className="mb-4 text-xl font-black text-slate-950">العقد المحفوظ</h2>
            <pre className="max-h-[720px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-5 text-sm leading-8 text-slate-700">{contractBody}</pre>
          </section>
        </div>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3"><dt className="font-bold text-slate-500">{label}</dt><dd className="text-left font-black text-slate-800">{value}</dd></div>;
}
