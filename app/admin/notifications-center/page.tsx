import Link from "next/link";
import { desc, asc } from "drizzle-orm";
import { NotificationTemplateForm } from "@/components/admin/enterprise/notification-template-form";
import { NotificationBroadcastForm } from "@/components/admin/notification-broadcast-form";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { db, notificationTemplates, notifications, stores, wings } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

export default async function NotificationsCenterPage() {
  const session = await requireAuth();
  await assertAdmin(session, "notifications.manage");
  const [templates, items, storeOptions, wingOptions] = hasDatabase()
    ? await Promise.all([
        db.select().from(notificationTemplates).orderBy(desc(notificationTemplates.createdAt)).limit(80),
        db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(80),
        db.select({ id: stores.id, name: stores.name, primaryWingId: stores.primaryWingId }).from(stores).orderBy(asc(stores.name)).limit(500),
        db.select({ id: wings.id, name: wings.name }).from(wings).orderBy(asc(wings.sortOrder), asc(wings.name))
      ])
    : [[], [], [], []];

  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container space-y-8 py-8">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-black text-slate-950">Notification / Email / SMS Center</h1><p className="mt-2 text-sm text-slate-500">قوالب ورسائل داخلية وبريدية ورسائل SMS وPush، مع إرسال إشعارات للمتاجر حسب النطاق.</p></div>
          <Button asChild variant="outline"><Link href="/admin">العودة</Link></Button>
        </div>
        <NotificationBroadcastForm stores={storeOptions} wings={wingOptions} />
        <NotificationTemplateForm />
        <div className="grid gap-8 lg:grid-cols-2"><List title="قوالب الإشعارات" items={templates.map((t) => ({ id: t.id, title: t.code, meta: t.channel, status: t.isActive ? "نشط" : "معطل" }))} /><List title="آخر الإشعارات" items={items.map((n) => ({ id: n.id, title: n.title, meta: n.type, status: n.readAt ? "مقروء" : "جديد" }))} /></div>
      </section>
    </main>
  );
}
function List({ title, items }: { title: string; items: Array<{ id: string; title: string; meta: string; status: string }> }) { return <div><h2 className="mb-4 text-xl font-black">{title}</h2>{!items.length ? <EmptyState title="لا توجد عناصر" /> : <div className="space-y-3">{items.map((i) => <article key={i.id} className="rounded-2xl border bg-white p-4 shadow-card"><div className="flex items-center justify-between"><div><h3 className="font-black">{i.title}</h3><p className="text-xs text-slate-500">{i.meta}</p></div><Badge variant="outline">{i.status}</Badge></div></article>)}</div>}</div>; }
