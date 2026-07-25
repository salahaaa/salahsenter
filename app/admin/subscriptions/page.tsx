import Link from "next/link";
import { desc } from "drizzle-orm";
import { SubscriptionForm } from "@/components/admin/subscription-form";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteResourceButton } from "@/components/ui/delete-resource-button";
import { db, subscriptions } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

export default async function AdminSubscriptionsPage() {
  const session = await requireAuth();
  await assertAdmin(session, "subscriptions.manage");
  const items = hasDatabase() ? await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)).limit(100) : [];
  return <main className="min-h-screen admin-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">إدارة الاشتراكات</h1><p className="mt-2 text-sm text-slate-500">أنشئ باقات وحدد حدود المنتجات والموظفين والإعلانات والفروع.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div><SubscriptionForm /><div className="mt-8">{!items.length ? <EmptyState title="لا توجد باقات" /> : <div className="grid gap-5 md:grid-cols-4">{items.map((item) => <article key={item.id} className="rounded-3xl border bg-white p-5 shadow-card"><div className="flex items-center justify-between"><h3 className="text-xl font-black text-slate-950">{item.name}</h3><Badge variant={item.isActive ? "success" : "outline"}>{item.code}</Badge></div><p className="mt-4 text-2xl font-black text-primary">{formatCurrency(item.price)}</p><ul className="mt-4 space-y-2 text-sm font-bold text-slate-600"><li>{formatNumber(item.maxProducts)} منتج</li><li>{formatNumber(item.maxEmployees)} موظف</li><li>{formatNumber(item.maxAnnouncements)} إعلان</li><li>{formatNumber(item.maxBranches)} فرع</li></ul><div className="mt-4"><DeleteResourceButton endpoint={`/api/admin/subscriptions/${item.id}`} /></div></article>)}</div>}</div></section></main>;
}
