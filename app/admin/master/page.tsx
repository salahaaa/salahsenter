export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { MasterGovernancePanel } from "@/components/admin/enterprise/master-governance-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { getMasterSettings, getMasterSettingsVersions, masterDomainRegistry } from "@/lib/master-settings";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

export default async function MasterAdminPage() {
  const session = await requireAuth();
  await assertAdmin(session, "master.manage");
  const [settings, versions] = await Promise.all([getMasterSettings(), getMasterSettingsVersions()]);
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 inline-flex rounded-full bg-blue-100 px-4 py-2 text-xs font-black text-blue-800">Master Governance Center</div><h1 className="text-3xl font-black text-slate-950 md:text-5xl">حوكمة الإدارة المركزية</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">مركز للسياسات العامة والـ feature flags والنسخ والتراجع. المجالات المالية والأمنية والدفع تبقى في لوحاتها المالكة حتى لا تتداخل مصادر الحقيقة.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/admin/settings">إعدادات الواجهة</Link></Button><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div></div><MasterGovernancePanel initialSettings={settings} initialVersions={JSON.parse(JSON.stringify(versions))} domains={[...masterDomainRegistry]}/></section></main>;
}
