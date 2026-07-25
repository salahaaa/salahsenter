import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { DefaultMediaForm } from "@/components/admin/default-media-form";
import { DefaultMediaEditForm } from "@/components/admin/default-media-edit-form";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteResourceButton } from "@/components/ui/delete-resource-button";
import { db, defaultActivityMedia, wings } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

export default async function AdminDefaultMediaPage() {
  const session = await requireAuth();
  await assertAdmin(session, "default_media.manage");
  const [media, wingItems] = hasDatabase()
    ? await Promise.all([
        db.select().from(defaultActivityMedia).orderBy(desc(defaultActivityMedia.createdAt)).limit(100),
        db.select({ id: wings.id, name: wings.name }).from(wings).orderBy(asc(wings.sortOrder), asc(wings.name))
      ])
    : [[], []];
  const wingName = new Map(wingItems.map((wing) => [wing.id, wing.name]));

  return <main className="min-h-screen admin-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">إدارة الصور الافتراضية للأنشطة</h1><p className="mt-2 text-sm text-slate-500">تستخدم عندما لا يرفع التاجر صورة غلاف أو شعار أو وسائط.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div><DefaultMediaForm wings={wingItems} /><div className="mt-8">{!media.length ? <EmptyState title="لا توجد صور افتراضية" /> : <div className="grid gap-5 md:grid-cols-4">{media.map((item) => <article key={item.id} className="overflow-hidden rounded-3xl border bg-white shadow-card"><img src={item.url} alt={item.alt || ""} className="h-40 w-full object-cover" loading="lazy" /><div className="p-4"><h3 className="font-black text-slate-950">{wingName.get(item.wingId) || "جناح"}</h3><div className="mt-2 flex items-center justify-between gap-2"><Badge variant="outline">{item.mediaType}</Badge><div className="flex gap-2"><DefaultMediaEditForm media={item} /><DeleteResourceButton endpoint={`/api/admin/default-media/${item.id}`} /></div></div></div></article>)}</div>}</div></section></main>;
}
