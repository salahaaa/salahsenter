import { CalendarDays, Megaphone, Pin, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type StoreNews = { id: string; title: string; body: string | null; linkUrl: string | null; isPinned: boolean; createdAt: Date; endAt: Date | null };
type StoreAnnouncement = { id: string; title: string; summary: string | null; body: string | null; imageUrl: string | null; linkUrl: string | null; isPinned: boolean; createdAt: Date; endAt: Date | null; isPromoted?: boolean; promotionPackage?: string | null };

export function StoreNewsTicker({ news }: { news: StoreNews[] }) {
  if (!news.length) return null;
  return (
    <div className="mb-5 overflow-hidden rounded-2xl border bg-slate-950 text-white shadow-card">
      <div className="flex min-h-12 items-center gap-4 px-4 py-3">
        <span className="flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black"><Megaphone className="h-4 w-4 text-amber-300" /> أخبار المتجر</span>
        <div className="min-w-0 flex-1 overflow-hidden text-sm font-bold text-slate-100">
          <div className="news-ticker-track inline-flex min-w-max gap-10 whitespace-nowrap">
            {news.map((item) => <span key={item.id}>{item.title}</span>)}
            {news.map((item) => <span key={`${item.id}-copy`} aria-hidden="true">{item.title}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StoreMarketingSection({ announcements, news }: { announcements: StoreAnnouncement[]; news: StoreNews[] }) {
  if (!announcements.length && !news.length) return <EmptyState title="لا توجد عروض أو أخبار حالياً" description="يمكن للتاجر إضافتها من لوحة التاجر، ولن تظهر في الصفحة الرئيسية للمول." />;
  return (
    <div>
      <StoreNewsTicker news={news} />
      {announcements.length ? <div className="grid gap-5 md:grid-cols-3">{announcements.map((item) => <StoreAnnouncementCard key={item.id} item={item} />)}</div> : null}
      {!announcements.length && news.length ? <p className="rounded-2xl border bg-white p-5 text-sm font-bold text-slate-500 shadow-card">لا توجد بطاقات عروض حالياً، توجد أخبار متجر فقط في الشريط أعلاه.</p> : null}
    </div>
  );
}

function StoreAnnouncementCard({ item }: { item: StoreAnnouncement }) {
  const remaining = item.endAt ? Math.ceil((new Date(item.endAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const backgroundColor = /^#[0-9a-f]{6}$/i.test(item.promotionPackage || "") ? item.promotionPackage || undefined : undefined;
  return (
    <article className="group overflow-hidden rounded-3xl border bg-white shadow-card transition hover:-translate-y-1 hover:shadow-soft" style={backgroundColor ? { backgroundColor } : undefined}>
      <div className="relative h-44 bg-slate-100">
        {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" /> : <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">صورة الإعلان اختيارية</div>}
        <div className="absolute right-3 top-3 flex gap-2">
          {item.isPinned ? <Badge variant="warning" className="gap-1"><Pin className="h-3 w-3" /> مثبت</Badge> : null}
          {item.isPromoted ? <Badge className="bg-purple-600 text-white">مروج</Badge> : null}
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><CalendarDays className="h-4 w-4" /> {new Intl.DateTimeFormat("ar").format(item.createdAt)}</div>
        <h3 className="mt-3 text-lg font-black text-slate-950">{item.title}</h3>
        {item.summary ? <p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-500">{item.summary}</p> : null}
        {remaining !== null ? <div className="mt-3 flex items-center gap-2 text-xs font-black text-amber-600"><Timer className="h-4 w-4" /> {remaining > 0 ? `ينتهي خلال ${remaining} يوم` : "انتهى اليوم"}</div> : null}
        {item.linkUrl ? <Button asChild variant="outline" className="mt-5 w-full"><a href={item.linkUrl}>عرض التفاصيل</a></Button> : <Button variant="outline" className="mt-5 w-full" disabled>عرض التفاصيل</Button>}
      </div>
    </article>
  );
}
