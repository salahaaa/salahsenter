import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ContractRenewalButton } from "@/components/merchant/contract-renewal-button";
import { requireAuth } from "@/lib/auth";
import { db, merchantApplications, merchantContracts, stores } from "@/lib/db";

const statusLabels: Record<string, string> = {
  pending: "قيد التقديم",
  under_review: "قيد المراجعة",
  documents_required: "مطلوب مستندات",
  waiting_for_data: "بانتظار تعديل بيانات",
  pre_approved: "قبول مبدئي",
  contract_created: "تم إنشاء العقد",
  contract_signed: "تم توقيع العقد",
  active: "مفعل",
  rejected: "مرفوض"
};

export default async function MerchantOnboardingPage() {
  const session = await requireAuth();
  const applications = await db.select().from(merchantApplications).where(eq(merchantApplications.applicantUserId, session.userId)).orderBy(desc(merchantApplications.createdAt)).limit(20);
  const contracts = await db.select({ contract: merchantContracts, store: stores }).from(merchantContracts).leftJoin(stores, eq(merchantContracts.storeId, stores.id)).where(eq(merchantContracts.merchantId, session.userId)).orderBy(desc(merchantContracts.createdAt)).limit(20);

  return (
    <main className="min-h-screen merchant-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div><h1 className="text-3xl font-black text-slate-950">حالة فتح المتجر والعقود</h1><p className="mt-2 text-sm text-slate-500">تابع حالة طلبك، راجع العقد، وقم بالتوقيع أو طلب التجديد.</p></div>
          <Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button>
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          <section><h2 className="mb-4 text-xl font-black">طلبات فتح المتجر</h2>{!applications.length ? <EmptyState title="لا توجد طلبات" /> : <div className="space-y-3">{applications.map((app) => <article key={app.id} className="rounded-3xl border bg-white p-5 shadow-card"><div className="flex items-center justify-between"><h3 className="font-black">{app.storeName}</h3><Badge variant={app.status === "active" ? "success" : app.status === "rejected" ? "danger" : "warning"}>{statusLabels[app.status] || app.status}</Badge></div><p className="mt-2 text-sm text-slate-500">رقم العقد: {app.onboardingContractNumber || "لم ينشأ بعد"}</p>{app.status === "contract_created" || app.status === "contract_signed" ? <Button asChild className="mt-4" size="sm"><Link href={`/apply-store/${app.id}/contract`}>مراجعة/توقيع العقد</Link></Button> : null}</article>)}</div>}</section>
          <section><h2 className="mb-4 text-xl font-black">العقود الفعالة</h2>{!contracts.length ? <EmptyState title="لا توجد عقود" /> : <div className="space-y-3">{contracts.map(({ contract, store }) => <article key={contract.id} className="rounded-3xl border bg-white p-5 shadow-card"><div className="flex items-center justify-between"><h3 className="font-black">{contract.contractNumber}</h3><Badge variant={contract.status === "active" ? "success" : "warning"}>{contract.status}</Badge></div><p className="mt-2 text-sm text-slate-500">المتجر: {store?.name || "-"}</p><p className="mt-1 text-sm text-slate-500">ينتهي: {new Intl.DateTimeFormat("ar").format(contract.endAt)}</p><ContractRenewalButton contractId={contract.id} status={contract.status} /></article>)}</div>}</section>
        </div>
      </section>
    </main>
  );
}
