export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { Cable } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { ErpIntegrationRequestPanel } from "@/components/merchant/erp-integration-request-panel";
import { requireAuth } from "@/lib/auth";
import { getMerchantErpIntegrationRequests } from "@/lib/integrations/erp/onboarding";

export default async function MerchantIntegrationsPage() {
  const session = await requireAuth();
  const data = await getMerchantErpIntegrationRequests(session.userId);
  return <main className="min-h-screen merchant-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700"><Cable className="h-4 w-4"/> ERP Integration</div><h1 className="text-3xl font-black text-slate-950">ربط النظام المحاسبي</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">اطلب ربط أي نظام محاسبي أو ERP تستخدمه. لا يتم فتح مزامنة المخزون والفواتير قبل مراجعة الإدارة، اتصال Agent، mapping، وشهادة الموصل.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/merchant/operations-settings">إعدادات التشغيل</Link></Button><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div></div><ErpIntegrationRequestPanel initial={JSON.parse(JSON.stringify(data))} /></section></main>;
}
