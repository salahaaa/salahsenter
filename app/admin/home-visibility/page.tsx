export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { HomeVisibilityForm } from "@/components/admin/home-visibility-form";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { getHomeVisibilityRules } from "@/lib/home-visibility";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

export default async function HomeVisibilityPage() {
  const session = await requireAuth();
  await assertAdmin(session, "home.manage");
  const rules = await getHomeVisibilityRules();
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-black text-slate-950">قواعد ظهور الواجهة الرئيسية</h1><p className="mt-2 text-sm text-slate-500">تحكم احترافي يمنع الفوضى: ما يظهر في الرئيسية يجب أن يكون مميزاً أو ممولاً أو مختاراً.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div><HomeVisibilityForm initial={rules}/></section></main>;
}
