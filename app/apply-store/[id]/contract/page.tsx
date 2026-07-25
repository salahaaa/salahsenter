import Link from "next/link";
import { eq } from "drizzle-orm";
import { CheckCircle2, Clock3, FileSignature, ShieldAlert } from "lucide-react";
import { ContractSignatureForm } from "@/components/forms/contract-signature-form";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApplicationFlowTimeline } from "@/components/applications/application-flow-timeline";
import { nextApplicationHint, statusLabels } from "@/lib/application-flow";
import { ContractDocumentView } from "@/components/contracts/contract-document-view";
import { db, merchantApplications } from "@/lib/db";
import { buildDefaultContract } from "@/lib/contracts";
import { getCurrentSession, hasRole } from "@/lib/auth";
import { safeCompareHash } from "@/lib/security";

const contractReadyStatuses = ["contract_created", "contract_signed", "waiting_final_approval", "approved", "active"];

export default async function ContractPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const [application] = await db.select().from(merchantApplications).where(eq(merchantApplications.id, id)).limit(1);
  if (!application) {
    return <main className="onboarding-atelier relative min-h-screen"><SiteHeader /><section className="container py-10"><h1 className="text-2xl font-black">طلب فتح المتجر غير موجود</h1></section></main>;
  }

  const session = await getCurrentSession();
  const token = resolvedSearchParams?.token;
  const canAccess =
    (session && hasRole(session, "super_admin")) ||
    (session?.userId && application.applicantUserId === session.userId) ||
    safeCompareHash(token, application.contractAccessTokenHash);

  if (!canAccess) {
    return (
      <main className="onboarding-atelier relative min-h-screen">
        <SiteHeader />
        <section className="container py-10">
          <div className="rounded-[2rem] border bg-white p-8 text-center shadow-card">
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-amber-500" />
            <h1 className="text-2xl font-black text-slate-950">رابط العقد غير صالح أو لا تملك صلاحية الوصول</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">سجّل الدخول بالحساب المرتبط بطلب فتح المتجر أو استخدم رابط العقد المرسل في التنبيهات.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3"><Button asChild><Link href={`/login?next=/apply-store/${id}/contract`}>تسجيل الدخول</Link></Button><Button asChild variant="outline"><Link href="/">الرئيسية</Link></Button></div>
          </div>
        </section>
      </main>
    );
  }

  if (!contractReadyStatuses.includes(application.status)) {
    return (
      <main className="onboarding-atelier relative min-h-screen">
        <SiteHeader />
        <section className="container space-y-6 py-10">
          <div className="rounded-[2rem] border bg-white p-8 text-center shadow-card">
            <Clock3 className="mx-auto mb-4 h-12 w-12 text-blue-500" />
            <h1 className="text-2xl font-black text-slate-950">لم يتم إرسال العقد للتوقيع بعد</h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">وصل طلبك إلى الإدارة، وسيظهر العقد هنا فقط بعد أن يراجع الأدمن الطلب ويضغط زر إرسال العقد للتوقيع. ستصلك رسالة في مركز التنبيهات عند توفر العقد.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3"><Button asChild><Link href={`/apply-store/${id}`}>متابعة حالة الطلب</Link></Button><Button asChild variant="outline"><Link href="/notifications">فتح التنبيهات</Link></Button></div>
          </div>
          <ApplicationFlowTimeline status={application.status} />
        </section>
      </main>
    );
  }

  const contractBody = application.contractBody || buildDefaultContract(application);
  const alreadySigned = Boolean(application.contractAcceptedAt && application.contractSignatureDataUrl);

  return (
    <main className="onboarding-atelier relative min-h-screen">
      <SiteHeader />
      <section className="container space-y-6 py-8">
        <div className="overflow-hidden rounded-[2rem] border bg-white p-6 shadow-card md:p-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="text-right">
              <Badge className="mb-4 bg-blue-50 text-blue-700"><FileSignature className="ml-1 h-4 w-4" /> عقد فتح متجر</Badge>
              <h1 className="text-3xl font-black text-slate-950 md:text-5xl">{application.storeName}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">{nextApplicationHint(application.status)}</p>
            </div>
            <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/apply-store/${application.id}`}>متابعة الطلب</Link></Button><Button asChild variant="outline"><Link href="/">الرئيسية</Link></Button></div>
          </div>
        </div>

        <ApplicationFlowTimeline status={application.status} />

        <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
          <ContractDocumentView
            application={{
              id: application.id,
              storeName: application.storeName,
              applicantName: application.applicantName,
              applicantEmail: application.applicantEmail,
              applicantPhone: application.applicantPhone,
              businessActivity: application.businessActivity,
              status: application.status,
              contractTitle: application.contractTitle,
              contractVersion: application.contractVersion,
              onboardingContractNumber: application.onboardingContractNumber,
              contractStartAt: application.contractStartAt?.toISOString() || null,
              contractEndAt: application.contractEndAt?.toISOString() || null,
              commissionRate: application.commissionRate,
              subscriptionFee: application.subscriptionFee
            }}
            contractBody={contractBody}
          />
          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            {alreadySigned ? (
              <div className="rounded-[2rem] border bg-white p-6 shadow-card">
                <CheckCircle2 className="mb-4 h-10 w-10 text-emerald-600" />
                <h2 className="text-xl font-black text-slate-950">تم توقيع العقد</h2>
                <p className="mt-2 text-sm leading-7 text-slate-500">تاريخ التوقيع: {application.contractAcceptedAt ? new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(application.contractAcceptedAt) : "-"}</p>
                {application.contractSignatureDataUrl ? <img src={application.contractSignatureDataUrl.startsWith("private-r2://") ? `/api/merchant-applications/${application.id}/signature` : application.contractSignatureDataUrl} alt="التوقيع الإلكتروني" className="mt-5 rounded-2xl border bg-slate-50 p-3" /> : null}
                <Button asChild className="mt-5 w-full"><Link href={`/apply-store/${application.id}`}>متابعة حالة الطلب</Link></Button>
              </div>
            ) : (
              <ContractSignatureForm applicationId={application.id} applicantName={application.applicantName} contractVersion={application.contractVersion} token={token} />
            )}
            <div className="rounded-[2rem] border bg-white p-5 text-sm leading-7 text-slate-600 shadow-card">
              <h3 className="mb-2 font-black text-slate-950">ماذا يحدث بعد التوقيع؟</h3>
              <p>ينتقل الطلب إلى انتظار الموافقة النهائية من الإدارة. بعد الموافقة سيتم إنشاء المتجر وفتح لوحة التاجر بنفس حسابك.</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
