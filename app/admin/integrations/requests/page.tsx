export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { ErpIntegrationRequestsPanel } from "@/components/admin/erp-integration-requests-panel";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";
import { getAdminErpIntegrationRequests } from "@/lib/integrations/erp/onboarding";

export default async function AdminErpIntegrationRequestsPage() {
  const session = await requireAuth();
  await assertAdminOperation(session, "erp.requests.review");
  const data = JSON.parse(JSON.stringify(await getAdminErpIntegrationRequests()));
  return <main className="min-h-screen admin-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700"><ClipboardCheck className="h-4 w-4"/> ERP Request Governance</div><h1 className="text-3xl font-black text-slate-950">طلبات ربط الأنظمة المحاسبية</h1><p className="mt-2 max-w-4xl text-sm leading-7 text-slate-500">دورة عامة لأي ERP: مراجعة التاجر، تعيين Connector، مفتاح إعداد محدود، Agent، mapping، شهادة، ثم تفعيل. لا يوجد دعم مزود فعلي بلا Connector وحزمة معتمدة.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/admin/integrations/certification">الشهادات</Link></Button><Button asChild variant="outline"><Link href="/admin/integrations">مركز التكامل</Link></Button><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div></div><ErpIntegrationRequestsPanel initial={data} /></section></main>;
}
