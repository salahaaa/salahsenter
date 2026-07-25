export const dynamic = "force-dynamic";

import Link from "next/link";
import { ListTree } from "lucide-react";
import { asc } from "drizzle-orm";
import { MenuBuilderPanel } from "@/components/admin/menu-builder-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { db, menuItems } from "@/lib/db";

export default async function MenuBuilderPage() {
  const session = await requireAuth();
  await assertAdmin(session, "home.manage");
  const items = await db.select().from(menuItems).orderBy(asc(menuItems.menuKey), asc(menuItems.sortOrder)).limit(300);
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700"><ListTree className="h-4 w-4"/> Live Menu Builder</div><h1 className="text-3xl font-black text-slate-950 md:text-5xl">منشئ القائمة العامة</h1><p className="mt-2 text-sm leading-7 text-slate-500">هذه العناصر تستخدم فعليًا في Header الواجهة العامة عند جعلها مرئية.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div><MenuBuilderPanel initialItems={items}/></section></main>;
}
