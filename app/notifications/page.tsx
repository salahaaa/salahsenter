export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { Bell } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { hasRole, requireAuth } from "@/lib/auth";
import { db, notifications } from "@/lib/db";

export default async function NotificationsPage() {
  const session = await requireAuth();
  const isAdmin = hasRole(session, "super_admin");
  const where = isAdmin
    ? or(eq(notifications.userId, session.userId), and(isNull(notifications.userId), isNull(notifications.storeId)))
    : eq(notifications.userId, session.userId);
  const items = await db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(100);
  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-black text-slate-950"><Bell className="h-8 w-8 text-blue-600" /> مركز التنبيهات</h1>
            <p className="mt-2 text-sm text-slate-500">التنبيهات الخاصة بحسابك فقط. تنبيهات الإدارة تظهر للأدمن فقط.</p>
          </div>
          <Button asChild variant="outline"><Link href="/">الرئيسية</Link></Button>
        </div>
        {!items.length ? <EmptyState title="لا توجد تنبيهات" /> : <div className="grid gap-4 md:grid-cols-2">{items.map((item) => <article key={item.id} className="rounded-3xl border bg-white p-5 shadow-card"><div className="flex items-start justify-between gap-3"><h3 className="font-black text-slate-950">{item.title}</h3><Badge variant={item.readAt ? "outline" : "warning"}>{item.readAt ? "مقروء" : "جديد"}</Badge></div>{item.body ? <p className="mt-3 text-sm leading-7 text-slate-500">{item.body}</p> : null}<p className="mt-3 text-xs font-bold text-slate-400">{new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(item.createdAt)}</p></article>)}</div>}
      </section>
    </main>
  );
}
