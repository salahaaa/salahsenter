import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { OfferCampaignForm } from "@/components/admin/offer-campaign-form";
import { AdminPromotionalOfferForm } from "@/components/admin/admin-promotional-offer-form";
import { AdminPromotionalOfferActions, AdminStoreOfferActions } from "@/components/admin/admin-offer-actions";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { adminPromotionalOffers, db, offerCampaigns, storeOfferCollections, stores } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

function statusVariant(status: string) {
  return status === "active" || status === "approved" ? "success" : status === "rejected" || status === "disabled" ? "danger" : "warning";
}

export default async function AdminOffersPage(){
  const session = await requireAuth();
  await assertAdmin(session, "offers.manage");
  const [campaigns, storeOffers, adminOffers] = hasDatabase()?await Promise.all([
    db.select().from(offerCampaigns).orderBy(desc(offerCampaigns.createdAt)).limit(80),
    db.select({offer:storeOfferCollections,store:stores,campaign:offerCampaigns}).from(storeOfferCollections).innerJoin(stores,eq(storeOfferCollections.storeId,stores.id)).leftJoin(offerCampaigns,eq(storeOfferCollections.campaignId,offerCampaigns.id)).orderBy(desc(storeOfferCollections.createdAt)).limit(160),
    db.select().from(adminPromotionalOffers).orderBy(desc(adminPromotionalOffers.createdAt)).limit(120)
  ]):[[],[],[]];

  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">Smart Offers Command Center</h1><p className="mt-2 text-sm text-slate-500">مواسم العروض، مراجعة عروض التجار، وعروض الإدارة الترويجية الخارجية من شاشة واحدة.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div>

  <div className="grid gap-8 xl:grid-cols-2"><OfferCampaignForm/><AdminPromotionalOfferForm/></div>

  <div className="mt-8 grid gap-8 xl:grid-cols-3">
    <section className="rounded-3xl border bg-white p-5 shadow-card"><h2 className="mb-4 text-xl font-black">المواسم والتصنيفات</h2>{!campaigns.length?<EmptyState title="لا توجد مناسبات"/>:<div className="max-h-[620px] space-y-3 overflow-auto">{campaigns.map(c=><article key={c.id} className="rounded-2xl border bg-slate-50 p-4"><div className="flex items-center justify-between"><h3 className="font-black">{c.name}</h3><Badge variant={c.status==='active'?'success':'outline'}>{c.status}</Badge></div><p className="mt-1 text-xs text-slate-500">{c.occasionType} — {c.isHomepageVisible ? "ظاهر" : "مخفي"}</p></article>)}</div>}</section>

    <section className="rounded-3xl border bg-white p-5 shadow-card xl:col-span-2"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-black">عروض التجار</h2><p className="mt-1 text-xs font-bold text-slate-500">قبول، رفض، إيقاف، حذف، ومراجعة العروض المنشورة مباشرة.</p></div><Badge variant="outline">{storeOffers.length}</Badge></div>{!storeOffers.length?<EmptyState title="لا توجد عروض"/>:<div className="overflow-x-auto rounded-2xl border"><table className="w-full min-w-[1050px] text-right text-sm"><thead className="bg-slate-100"><tr><th className="p-3">العرض</th><th className="p-3">المتجر</th><th className="p-3">الموسم</th><th className="p-3">الحالة</th><th className="p-3">مخزون العرض</th><th className="p-3">الفترة</th><th className="p-3">تحكم الإدارة</th></tr></thead><tbody>{storeOffers.map(({offer,store,campaign})=><tr key={offer.id} className="border-t hover:bg-slate-50"><td className="p-3"><div className="font-black">{offer.title}</div><div className="line-clamp-1 text-xs text-slate-500">{offer.description || "-"}</div></td><td className="p-3">{store.name}</td><td className="p-3">{campaign?.name||'بدون موسم'}</td><td className="p-3"><Badge variant={statusVariant(offer.status) as any}>{offer.status}</Badge></td><td className="p-3 text-xs font-bold text-slate-600">{Number(offer.bundleInitialQuantity || 0) ? `${offer.bundleRemainingQuantity}/${offer.bundleInitialQuantity}` : "مباشر"}</td><td className="p-3 text-xs text-slate-500">{offer.startsAt ? new Intl.DateTimeFormat("ar").format(offer.startsAt) : "-"} ← {offer.endsAt ? new Intl.DateTimeFormat("ar").format(offer.endsAt) : "-"}</td><td className="p-3"><AdminStoreOfferActions offerId={offer.id} status={offer.status} startsAt={offer.startsAt} endsAt={offer.endsAt} visibilitySchedule={offer.visibilitySchedule} bundleRemainingQuantity={Number(offer.bundleRemainingQuantity || 0)}/></td></tr>)}</tbody></table></div>}</section>
  </div>

  <section className="mt-8 rounded-3xl border bg-white p-5 shadow-card"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-black">عروض الإدارة الترويجية</h2><p className="mt-1 text-xs font-bold text-slate-500">عروض تسويقية خارجية: صورة/فيديو/رابط/واتساب/بيانات تواصل.</p></div><Badge variant="outline">{adminOffers.length}</Badge></div>{!adminOffers.length?<EmptyState title="لا توجد عروض إدارة"/>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{adminOffers.map((offer)=><article key={offer.id} className="overflow-hidden rounded-3xl border bg-slate-50"><div className="h-40 bg-slate-100">{offer.imageUrl ? <img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-cover" loading="lazy"/> : null}</div><div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{offer.title}</h3><p className="text-xs text-slate-500">{offer.category}</p></div><Badge variant={statusVariant(offer.status) as any}>{offer.status}</Badge></div><p className="line-clamp-2 text-sm text-slate-600">{offer.description || "-"}</p><AdminPromotionalOfferActions offerId={offer.id} status={offer.status} startsAt={offer.startsAt} endsAt={offer.endsAt} visibilitySchedule={offer.visibilitySchedule}/></div></article>)}</div>}</section>
  </section></main>
}
