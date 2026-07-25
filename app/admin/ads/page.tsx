import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { BannerForm } from "@/components/admin/banner-form";
import { AdminNewsForm } from "@/components/admin/news-form";
import { NewsInlineEditor } from "@/components/admin/news-inline-editor";
import { AdvertisingSettingsForm } from "@/components/admin/advertising-settings-form";
import { MarketplaceAnnouncementForm } from "@/components/admin/marketplace-announcement-form";
import { AdminAdContentActions } from "@/components/admin/admin-ad-content-actions";
import { AdCampaignAdminActions } from "@/components/admin/ad-campaign-admin-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteResourceButton } from "@/components/ui/delete-resource-button";
import { adCampaigns, announcements, banners, db, news, stores } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { getAdvertisingSettings } from "@/lib/advertising-settings";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { inlineMediaSql, inlineMediaValueSql } from "@/lib/inline-media";
import { formatCurrency } from "@/lib/utils";

const bannerProjection = {
  id: banners.id,
  title: banners.title,
  status: banners.status,
  imageUrl: inlineMediaSql("banners", banners.id, "imageUrl", banners.imageUrl),
  placement: banners.placement,
  startAt: banners.startAt,
  endAt: banners.endAt,
  visibilitySchedule: banners.visibilitySchedule
};

const announcementProjection = {
  id: announcements.id,
  title: announcements.title,
  status: announcements.status,
  imageUrl: inlineMediaSql("announcements", announcements.id, "imageUrl", announcements.imageUrl),
  startAt: announcements.startAt,
  endAt: announcements.endAt,
  visibilitySchedule: announcements.visibilitySchedule
};

const campaignProjection = {
  id: adCampaigns.id,
  name: adCampaigns.name,
  type: adCampaigns.type,
  status: adCampaigns.status,
  budget: adCampaigns.budget,
  dailyBudget: adCampaigns.dailyBudget,
  startsAt: adCampaigns.startsAt,
  endsAt: adCampaigns.endsAt,
  createdAt: adCampaigns.createdAt,
  adminNote: adCampaigns.adminNote,
  storeName: stores.name,
  storeSlug: stores.slug,
  headline: sql<string | null>`${adCampaigns.creative}->>'headline'`,
  description: sql<string | null>`${adCampaigns.creative}->>'description'`,
  linkUrl: sql<string | null>`${adCampaigns.creative}->>'linkUrl'`,
  imageUrl: inlineMediaValueSql("adCampaigns", adCampaigns.id, "creativeImageUrl", sql<string | null>`${adCampaigns.creative}->>'imageUrl'`),
  publishedBannerId: sql<string | null>`${adCampaigns.creative}->>'publishedBannerId'`
};

type MerchantAdRequest = {
  id: string;
  name: string;
  type: string;
  status: string;
  budget: string;
  dailyBudget: string;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  adminNote: string | null;
  storeName: string;
  storeSlug: string;
  headline: string | null;
  description: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  publishedBannerId: string | null;
};

export default async function AdminAdsPage() {
  const session = await requireAuth();
  await assertAdmin(session, "ads.manage");
  const [adSettings, bannerItems, announcementItems, merchantAdRequests, newsItems] = hasDatabase()
    ? await Promise.all([
        getAdvertisingSettings(),
        db.select(bannerProjection).from(banners).orderBy(desc(banners.createdAt)).limit(30),
        db.select(announcementProjection).from(announcements).where(eq(announcements.level, "marketplace")).orderBy(desc(announcements.createdAt)).limit(30),
        db
          .select(campaignProjection)
          .from(adCampaigns)
          .innerJoin(stores, eq(adCampaigns.storeId, stores.id))
          .where(inArray(adCampaigns.type, ["homepage_banner", "category_banner", "sponsored_products", "featured_products"]))
          .orderBy(desc(adCampaigns.createdAt))
          .limit(80),
        db.select().from(news).where(eq(news.level, "marketplace")).orderBy(desc(news.createdAt)).limit(40)
      ])
    : [await getAdvertisingSettings(), [], [], [], []];

  const pendingHomepageRequests = merchantAdRequests.filter((item) => item.type === "homepage_banner" && ["pending_review", "draft", "submitted"].includes(item.status)).length;

  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">الإعلانات والبانرات</h1>
            <p className="mt-2 text-sm text-slate-500">إدارة بانرات الإدارة واستقبال طلبات إعلانات المتاجر ونشر بنراتها في الواجهة الرئيسية.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-red-50 text-red-700">طلبات بنر رئيسية: {pendingHomepageRequests}</Badge>
            <Button asChild variant="outline"><Link href="/admin">العودة</Link></Button>
          </div>
        </div>

        <section className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-900">
          تم تحسين هذه الصفحة حتى لا تحمل صور base64 الثقيلة داخل HTML. الصور تعرض عبر مسار آمن، وطلبات إعلانات المتاجر أصبحت هنا مباشرة مع زر «اعتماد ونشر في البنر».
        </section>

        <section className="mb-10 rounded-3xl border bg-white p-6 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">طلبات إعلانات المتاجر</h2>
              <p className="mt-1 text-xs font-bold text-slate-500">أي تاجر يرسل Homepage Banner يظهر هنا. عند الاعتماد ينشأ/يحدّث بانر في لوحة الصفحة الرئيسية تلقائياً.</p>
            </div>
            <Button asChild variant="outline" size="sm"><Link href="/admin/ads-platform">فتح منصة الإعلانات التحليلية</Link></Button>
          </div>
          <MerchantAdRequestsList items={merchantAdRequests} />
        </section>

        <div className="mb-8 rounded-3xl border bg-white p-6 shadow-card">
          <h2 className="mb-4 text-xl font-black">إعدادات الإعلانات والأخبار</h2>
          <AdvertisingSettingsForm initial={adSettings} />
        </div>

        <div className="grid gap-8 xl:grid-cols-2">
          <div><h2 className="mb-4 text-xl font-black">إضافة بانر رئيسي</h2><BannerForm /></div>
          <div><h2 className="mb-4 text-xl font-black">إضافة إعلان مول</h2><MarketplaceAnnouncementForm /></div>
        </div>

        <div className="mt-10 grid gap-8 xl:grid-cols-2">
          <List title="البانرات" kind="banner" items={bannerItems} />
          <List title="إعلانات المول" kind="announcement" items={announcementItems} />
        </div>

        <section id="news" className="mt-10 rounded-3xl border bg-white p-6 shadow-card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">أخبار المول والشريط المتحرك</h2>
              <p className="mt-1 text-xs font-bold text-slate-500">تم دمج الأخبار هنا لتصبح الإعلانات والبانرات والأخبار في نافذة واحدة.</p>
            </div>
            <Badge variant="outline">{newsItems.length} خبر</Badge>
          </div>
          <AdminNewsForm />
          <NewsList items={newsItems} />
        </section>
      </section>
    </main>
  );
}

function MerchantAdRequestsList({ items }: { items: MerchantAdRequest[] }) {
  if (!items.length) return <EmptyState title="لا توجد طلبات إعلانات متاجر" />;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map((item) => (
        <article key={item.id} className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          {item.imageUrl ? <img src={item.imageUrl} alt={item.headline || item.name} className="h-44 w-full object-cover" loading="lazy" decoding="async" /> : <div className="grid h-24 place-items-center bg-slate-50 text-xs font-bold text-slate-400">لا توجد صورة بنر</div>}
          <div className="space-y-3 p-4 text-right">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-black text-slate-950">{item.headline || item.name}</h3>
                <p className="mt-1 text-xs font-bold text-slate-500">{item.storeName} • {item.type}</p>
              </div>
              <Badge variant={item.status === "active" || item.status === "approved" ? "success" : item.status === "rejected" ? "danger" : "warning"}>{item.status}</Badge>
            </div>
            {item.description ? <p className="line-clamp-2 text-sm leading-7 text-slate-600">{item.description}</p> : null}
            <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-500">
              <Badge variant="outline">ميزانية: {formatCurrency(item.budget)}</Badge>
              <Badge variant="outline">يومي: {formatCurrency(item.dailyBudget)}</Badge>
              {item.publishedBannerId ? <Badge className="bg-blue-50 text-blue-700">مرتبط ببنر رئيسي</Badge> : null}
            </div>
            <AdCampaignAdminActions id={item.id} status={item.status} type={item.type} publishedBannerId={item.publishedBannerId} />
          </div>
        </article>
      ))}
    </div>
  );
}

function List({ title, kind, items }: { title: string; kind: "banner" | "announcement"; items: Array<{ id: string; title: string; status: string; imageUrl?: string | null; placement?: string; startAt?: Date | null; endAt?: Date | null; visibilitySchedule?: unknown }> }) {
  return <div><h2 className="mb-4 text-xl font-black">{title}</h2>{!items.length ? <EmptyState title="لا توجد عناصر" /> : <div className="space-y-3">{items.map((item) => <div key={item.id} className="rounded-2xl border bg-white p-4 shadow-card"><div className="flex items-center gap-4">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-16 w-24 rounded-xl object-cover" loading="lazy" decoding="async" /> : null}<div className="min-w-0 flex-1"><h3 className="truncate font-black">{item.title}</h3><div className="mt-2 flex flex-wrap gap-2"><Badge variant={item.status === "active" ? "success" : "outline"}>{item.status}</Badge>{item.placement ? <Badge variant="outline">{item.placement}</Badge> : null}</div></div></div><AdminAdContentActions id={item.id} kind={kind} status={item.status} startAt={item.startAt} endAt={item.endAt} visibilitySchedule={item.visibilitySchedule} /></div>)}</div>}</div>;
}

function NewsList({ items }: { items: Array<any> }) {
  if (!items.length) return <EmptyState title="لا توجد أخبار" />;
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <article key={item.id} className="rounded-3xl border bg-slate-50 p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-black text-slate-950">{item.title}</h3>
            <Badge variant={item.status === "active" ? "success" : "outline"}>{item.status}</Badge>
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-7 text-slate-500">{item.body || "بدون تفاصيل"}</p>
          <div className="mt-4 flex flex-wrap gap-2"><NewsInlineEditor item={item} endpoint={`/api/admin/news/${item.id}`} /><DeleteResourceButton endpoint={`/api/admin/news/${item.id}`} /></div>
        </article>
      ))}
    </div>
  );
}
