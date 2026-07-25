import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { PlatformProtectionCenter } from "@/components/admin/platform-protection-center";
import { SecurityControlPanel } from "@/components/admin/security-control-panel";
import { SecurityAlertsPanel } from "@/components/admin/security-alerts-panel";
import { AdminAccessAssurancePanel } from "@/components/admin/admin-access-assurance-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { getPlatformSecuritySettings } from "@/lib/security-settings";
import { getSecurityCenterData } from "@/lib/security-monitor";
import { getAdminProtectionSnapshot } from "@/lib/admin/platform-protection-center";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";

export default async function AdminSecurityPage() {
  const session = await requireAuth();
  await assertAdminOperation(session, "system.security_center.manage");
  const [settings, securityData, protectionSnapshot] = await Promise.all([getPlatformSecuritySettings(), getSecurityCenterData(), getAdminProtectionSnapshot()]);
  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-black text-red-700"><ShieldAlert className="h-4 w-4" /> Security Center</div>
            <h1 className="text-3xl font-black text-slate-950 md:text-5xl">مركز حماية المنصة</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">مراقبة Live، كشف أعطال وأخطار أمنية، تحليل سبب جذري بالذكاء الاصطناعي، إدارة حوادث، تنبيهات، وإصلاح ذاتي آمن.</p>
          </div>
          <Button asChild variant="outline"><Link href="/admin">العودة</Link></Button>
        </div>
        <div className="mb-8">
          <AdminAccessAssurancePanel />
        </div>
        <div className="mb-8">
          <PlatformProtectionCenter initialSnapshot={protectionSnapshot} />
        </div>
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border bg-white p-5 shadow-card"><p className="text-sm font-bold text-slate-500">تنبيهات مفتوحة</p><p className="mt-2 text-3xl font-black text-slate-950">{securityData.metrics.open}</p></div>
          <div className="rounded-3xl border bg-white p-5 shadow-card"><p className="text-sm font-bold text-slate-500">حرجة</p><p className="mt-2 text-3xl font-black text-red-600">{securityData.metrics.critical}</p></div>
          <div className="rounded-3xl border bg-white p-5 shadow-card"><p className="text-sm font-bold text-slate-500">عالية</p><p className="mt-2 text-3xl font-black text-amber-600">{securityData.metrics.high}</p></div>
          <div className="rounded-3xl border bg-white p-5 shadow-card"><p className="text-sm font-bold text-slate-500">قيد التحقيق</p><p className="mt-2 text-3xl font-black text-blue-600">{securityData.metrics.investigating}</p></div>
        </div>
        <div className="mb-8"><SecurityAlertsPanel alerts={securityData.alerts} /></div>
        <SecurityControlPanel initial={settings} />
      </section>
    </main>
  );
}
