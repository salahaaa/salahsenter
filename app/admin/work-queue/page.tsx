export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { ListChecks } from "lucide-react";
import { AdminWorkQueuePanel } from "@/components/admin/admin-work-queue-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { getAdminWorkQueue, getAssignableAdminUsers } from "@/lib/admin/work-queue";
import { assertAdmin } from "@/lib/rbac";

export default async function AdminWorkQueuePage() {
  const session = await requireAuth();
  await assertAdmin(session, "admin.access");
  const [items, assignees] = await Promise.all([getAdminWorkQueue(), getAssignableAdminUsers()]);
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700"><ListChecks className="h-4 w-4"/> Unified Admin Work Queue</div><h1 className="text-3xl font-black text-slate-950 md:text-5xl">طابور عمل الإدارة الموحد</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">طلبات التجار، الاعتمادات، التحصيل، السحب، ERP، العقود والتنبيهات الأمنية في قائمة واحدة مع مسؤول وSLA.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div><AdminWorkQueuePanel initialItems={JSON.parse(JSON.stringify(items))} assignees={assignees}/></section></main>;
}
