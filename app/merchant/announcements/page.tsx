import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { StoreAnnouncementForm } from "@/components/merchant/store-announcement-form";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NewsInlineEditor } from "@/components/admin/news-inline-editor";
import { AnnouncementInlineEditor } from "@/components/merchant/announcement-inline-editor";
import { requireAuth } from "@/lib/auth";
import { announcements, db, news } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";

export default async function MerchantAnnouncementsPage() {
  const session = await requireAuth();
  const store = await getMerchantPrimaryStore(session.userId);
  const [announcementItems, newsItems] = store
    ? await Promise.all([
        db.select().from(announcements).where(and(eq(announcements.storeId, store.id), eq(announcements.level, "store"))).orderBy(desc(announcements.createdAt)).limit(50),
        db.select().from(news).where(and(eq(news.storeId, store.id), eq(news.level, "store"))).orderBy(desc(news.createdAt)).limit(50)
      ])
    : [[], []];
  return <main className="min-h-screen merchant-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">عروض وأخبار المتجر</h1><p className="mt-2 text-sm text-slate-500">تظهر داخل صفحة المتجر فقط ولا تظهر في الصفحة الرئيسية للمول.</p></div><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div>{!store ? <EmptyState title="لا يوجد متجر" /> : <><StoreAnnouncementForm storeId={store.id} storeSlug={store.slug} /><div className="mt-8 grid gap-8 lg:grid-cols-2"><ContentList title="إعلانات وعروض" items={announcementItems} endpointBase="/api/merchant/announcements" storeId={store.id} isAnnouncement /><ContentList title="أخبار المتجر" items={newsItems} endpointBase="/api/merchant/news" /></div></>}</section></main>;
}

function ContentList({ title, items, endpointBase, storeId, isAnnouncement = false }: { title: string; endpointBase?: string; storeId?: string; isAnnouncement?: boolean; items: Array<{ id: string; title: string; status: string; isPinned: boolean; createdAt: Date; body?: string | null; summary?: string | null; imageUrl?: string | null; linkUrl?: string | null; isTicker?: boolean; promotionPackage?: string | null; startAt?: Date | null; endAt?: Date | null }> }) {
  return <div><h2 className="mb-4 text-xl font-black">{title}</h2>{!items.length ? <EmptyState title="لا توجد عناصر" /> : <div className="space-y-3">{items.map((item) => <article key={item.id} className="rounded-2xl border bg-white p-4 shadow-card"><div className="flex items-center justify-between gap-4"><h3 className="font-black text-slate-950">{item.title}</h3><Badge variant={item.status === "active" ? "success" : "outline"}>{item.status}</Badge></div><p className="mt-2 text-xs text-slate-500">{new Intl.DateTimeFormat("ar").format(item.createdAt)} {item.isPinned ? "— مثبت" : ""}</p>{endpointBase && isAnnouncement && storeId ? <AnnouncementInlineEditor item={item} endpoint={`${endpointBase}/${item.id}`} storeId={storeId} /> : endpointBase ? <NewsInlineEditor item={{ ...item, body: item.body || null, linkUrl: item.linkUrl || null, isTicker: Boolean(item.isTicker), startAt: item.startAt || null, endAt: item.endAt || null }} endpoint={`${endpointBase}/${item.id}`} /> : null}</article>)}</div>}</div>;
}
