export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { Scale } from "lucide-react";
import { ReconciliationDashboard } from "@/components/admin/reconciliation-dashboard";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { getReconciliationDashboardData } from "@/lib/integrations/accounting/reliability";

export default async function AdminIntegrationReconciliationPage() {
  const session = await requireAuth();
  await assertAdmin(session, "security.manage");
  const data = JSON.parse(JSON.stringify(await getReconciliationDashboardData()));
  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-black text-amber-700"><Scale className="h-4 w-4" /> ERP Reconciliation</div>
            <h1 className="text-3xl font-black text-slate-950 md:text-5xl">لوحة مطابقة ERP والمخزون</h1>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-500">مراقبة Idempotency/Retry/Failed Sync، الحجوزات المنتهية، الطلبات المنتظرة لفاتورة ERP، وتعارضات المخزون المتاح.</p>
          </div>
          <div className="flex gap-2"><Button asChild variant="outline"><Link href="/admin/integrations">إدارة التكاملات</Link></Button><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div>
        </div>
        <ReconciliationDashboard initial={data} />
      </section>
    </main>
  );
}
