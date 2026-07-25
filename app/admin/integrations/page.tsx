export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import nextDynamic from "next/dynamic";
import { ServerCog } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";
import { listIntegrationDashboardData } from "@/lib/integrations/erp/admin-service";

const IntegrationManagementPanel = nextDynamic(() => import("@/components/admin/integration-management-panel").then((module) => module.IntegrationManagementPanel), { loading: () => <div className="rounded-3xl border bg-white p-8 text-center text-sm font-bold text-slate-500">جارٍ تحميل مركز التكامل...</div> });

export default async function AdminIntegrationsPage() {
  const session = await requireAuth();
  await assertAdminOperation(session, "system.integrations.manage");
  const data = JSON.parse(JSON.stringify(await listIntegrationDashboardData()));
  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700"><ServerCog className="h-4 w-4" /> ERP Integration Infrastructure</div>
            <h1 className="text-3xl font-black text-slate-950 md:text-5xl">إدارة تكامل الأنظمة المحاسبية</h1>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-500">إنشاء عملاء التكامل، مفاتيح API، Mapping Profiles، مراقبة Agents، Entity Links، Events وSync Runs لكل متجر بدون DB-to-DB أو منطق ERP hardcoded.</p>
          </div>
          <div className="flex gap-2"><Button asChild variant="outline"><Link href="/admin/integrations/requests">طلبات ERP</Link></Button><Button asChild variant="outline"><Link href="/admin/integrations/certification">شهادات ERP</Link></Button><Button asChild variant="outline"><Link href="/admin/integrations/conflicts">تعارضات ERP</Link></Button><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div>
        </div>
        <IntegrationManagementPanel initial={data} />
      </section>
    </main>
  );
}
