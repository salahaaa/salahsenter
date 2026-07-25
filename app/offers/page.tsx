export const revalidate = 120;

import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowLeft, Crown, Flame, Gift, Sparkles, Store, Tag, Timer, Zap } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DatabaseReadinessState } from "@/components/public/database-readiness-state";
import { databaseFailureState, getDatabaseReadiness } from "@/lib/database-readiness";
import { getCachedPublicOffersPageData } from "@/lib/cache/public-offers-cache";
import { getOffersPageSettings } from "@/lib/offers-page-settings";
import { StructuredData, breadcrumbJsonLd } from "@/components/seo/structured-data";
import { absolutePublicUrl } from "@/lib/seo";
import { formatNumber } from "@/lib/utils";

function parseMeta(raw?: string | null) { try { return raw ? JSON.parse(raw) as Record<string, any> : {}; } catch { return {}; } }
function daysLeft(end?: Date | string | null) { if (!end) return null; const n = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000); return n > 0 ? n : 0; }
function discount(original: unknown, offer: unknown) { const o=Number(original||0), f=Number(offer||0); return o>0&&f>0&&f<o?Math.round(((o-f)/o)*100):0; }

function bucketOffers(offers: any[]) {
  const used = new Set<string>();
  const pick = (predicate: (offer: any) => boolean, limit = 12) => {
    const rows = offers.filter((offer) => !used.has(offer.id) && predicate(offer)).slice(0, limit);
    rows.forEach((offer) => used.add(offer.id));
    return rows;
  };
  const today = pick((offer) => daysLeft(offer.endsAt) !== null && daysLeft(offer.endsAt)! <= 1);
  const exclusive = pick((offer) => offer.isPromoted || parseMeta(offer.promotionPackage).offerType === "exclusive");
  const trending = pick(() => true, 12).sort((a,b)=>Number(b.itemsCount||0)-Number(a.itemsCount||0));
  const newOffers = pick(() => true, 12);
  const other = pick(() => true, 999);
  return { today, exclusive, trending, newOffers, other };
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getOffersPageSettings();
  const title = settings.heroTitle || "العروض والخصومات";
  const description = settings.heroDescription || "اكتشف عروض المتاجر والخصومات الموسمية داخل صلاح سنتر.";
  const canonical = absolutePublicUrl("/offers");
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, images: settings.heroBackgroundImage ? [{ url: settings.heroBackgroundImage }] : undefined } };
}

export default async function OffersPage() {
  let data: Awaited<ReturnType<typeof getCachedPublicOffersPageData>>;
  let readinessState: Awaited<ReturnType<typeof getDatabaseReadiness>>["state"] | null = null;
  const settings = await getOffersPageSettings();
  try {
    data = await getCachedPublicOffersPageData();
  } catch (error) {
    console.error("Failed to load cached public offers", error);
    readinessState = await databaseFailureState(error);
    data = { unavailable: true, offers: [], adminOffers: [] };
  }
  if (data.unavailable) {
    const state = readinessState || (await getDatabaseReadiness()).state;
    return <main className="min-h-screen bg-slate-50"><SiteHeader /><section className="container py-10"><DatabaseReadinessState state={state} /></section><Footer /></main>;
  }

  const buckets = bucketOffers(data.offers);
  const totalMerchant = data.offers.length;
  const allCount = totalMerchant + data.adminOffers.length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,.18),_transparent_30%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,.16),transparent_25%),linear-gradient(180deg,#f8fafc_0%,#fff7ed_42%,#f8fafc_100%)]">
      <SiteHeader />
      <StructuredData data={[{ "@context": "https://schema.org", "@type": "OfferCatalog", name: settings.heroTitle || "عروض صلاح سنتر", url: absolutePublicUrl("/offers"), numberOfItems: allCount }, breadcrumbJsonLd([{ name: "الرئيسية", url: absolutePublicUrl("/") }, { name: "العروض", url: absolutePublicUrl("/offers") }])]} />
      <section className="relative overflow-hidden text-white" style={{ backgroundColor: settings.heroBackgroundColor, color: settings.heroTextColor }}>
        {settings.heroBackgroundImage ? <img src={settings.heroBackgroundImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" /> : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,158,11,.24),transparent_30%),radial-gradient(circle_at_85%_35%,rgba(37,99,235,.24),transparent_28%)]" />
        <div className="container relative grid gap-8 py-14 md:grid-cols-[1fr_360px] md:items-center md:py-20">
          <div className="text-right"><Badge className="mb-5 bg-amber-500 text-white"><Sparkles className="ml-1 h-4 w-4" /> {settings.heroBadge}</Badge><h1 className="text-4xl font-black leading-tight md:text-6xl">{settings.heroTitle}</h1><p className="mt-5 max-w-3xl text-base leading-8 opacity-80">{settings.heroDescription}</p>{settings.showHeroButtons ? <div className="mt-7 flex flex-wrap gap-3">{settings.heroPrimaryLabel ? <a href={settings.heroPrimaryUrl || "#merchant-offers"} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950">{settings.heroPrimaryLabel}</a> : null}{settings.heroSecondaryLabel ? <a href={settings.heroSecondaryUrl || "#admin-offers"} className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-black text-white">{settings.heroSecondaryLabel}</a> : null}</div> : null}</div>
          <div className="rounded-[2rem] border border-white/10 bg-white/10 p-6 text-right backdrop-blur"><div className="grid grid-cols-2 gap-3"><Stat label="كل العروض" value={allCount}/><Stat label="عروض التجار" value={totalMerchant}/><Stat label="عروض الإدارة" value={data.adminOffers.length}/><Stat label="الحصرية" value={buckets.exclusive.length}/></div></div>
        </div>
      </section>

      <section className="container py-8"><div className="grid gap-3 md:grid-cols-6"><CategoryChip href="#offers-today" icon={<Zap/>} title="عروض اليوم" count={buckets.today.length}/><CategoryChip href="#offers-exclusive" icon={<Crown/>} title="الحصرية" count={buckets.exclusive.length}/><CategoryChip href="#offers-trending" icon={<Flame/>} title="الرائجة" count={buckets.trending.length}/><CategoryChip href="#offers-new" icon={<Sparkles/>} title="الجديدة" count={buckets.newOffers.length}/><CategoryChip href="#merchant-offers" icon={<Store/>} title="عروض المتاجر" count={totalMerchant}/><CategoryChip href="#admin-offers" icon={<Gift/>} title="عروض الإدارة" count={data.adminOffers.length}/></div></section>

      <OfferSection id="offers-today" title="عروض اليوم" subtitle="تنتهي قريباً" offers={buckets.today} empty="لا توجد عروض تنتهي اليوم" />
      <OfferSection id="offers-exclusive" title="العروض الحصرية" subtitle="مختارة ومميزة" offers={buckets.exclusive} empty="لا توجد عروض حصرية حالياً" />
      <OfferSection id="offers-trending" title="العروض الرائجة" subtitle="الأكثر نشاطاً" offers={buckets.trending} empty="لا توجد عروض رائجة" />
      <OfferSection id="offers-new" title="العروض الجديدة" subtitle="آخر ما تمت إضافته" offers={buckets.newOffers} empty="لا توجد عروض جديدة" />
      <OfferSection id="merchant-offers" title={settings.listTitle} subtitle={settings.listSubtitle} description={settings.listDescription} backgroundColor={settings.listBackgroundColor} textColor={settings.listTextColor} backgroundImage={settings.listBackgroundImage} offers={buckets.other} empty="لا توجد عروض إضافية" />

      <section id="admin-offers" className="container py-8"><div className="mb-6 text-right"><p className="text-xs font-black uppercase text-orange-600">ADMIN PROMOTIONS</p><h2 className="text-3xl font-black text-slate-950">{settings.adminSectionTitle}</h2><p className="mt-2 text-sm text-slate-500">{settings.adminSectionSubtitle}</p></div>{!data.adminOffers.length?<EmptyState title="لا توجد عروض إدارة حالياً"/>:<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{data.adminOffers.map((offer)=><AdminOfferCard key={offer.id} offer={offer}/>)}</div>}</section>

      <section className="container py-8"><div className="rounded-[2rem] border bg-slate-950 p-7 text-right text-white shadow-card"><Badge className="mb-3 bg-emerald-500 text-white">AI Recommendation</Badge><h2 className="text-2xl font-black">{settings.recommendationTitle}</h2><p className="mt-2 text-sm leading-7 text-white/70">{settings.recommendationDescription}</p><div className="mt-5 flex flex-wrap gap-2">{[...buckets.exclusive, ...buckets.trending].slice(0,5).map((offer)=><Link key={offer.id} href={`/offers/${offer.id}`} className="rounded-full bg-white/10 px-4 py-2 text-xs font-black hover:bg-white/20">{offer.title}</Link>)}</div></div></section>
      <Footer />
    </main>
  );
}
function Stat({label,value}:{label:string;value:number}){return <div className="rounded-2xl bg-white/10 p-4"><div className="text-3xl font-black">{formatNumber(value)}</div><div className="mt-1 text-xs font-bold text-white/60">{label}</div></div>}
function CategoryChip({href,icon,title,count}:{href:string;icon:ReactNode;title:string;count:number}){return <a href={count?href:undefined} className={`rounded-3xl border bg-white p-4 text-right shadow-card transition ${count?"hover:-translate-y-1 hover:shadow-soft":"opacity-60"}`}><div className="mb-2 inline-flex rounded-2xl bg-blue-50 p-2 text-blue-600">{icon}</div><h3 className="font-black">{title}</h3><p className="text-xs font-bold text-slate-500">{formatNumber(count)} عرض</p></a>}
function OfferSection({id,title,subtitle,description,backgroundColor,textColor,backgroundImage,offers,empty}:{id:string;title:string;subtitle:string;description?:string;backgroundColor?:string;textColor?:string;backgroundImage?:string;offers:any[];empty:string}){return <section id={id} className="container py-8"><div className="relative overflow-hidden rounded-[2rem] p-5" style={{backgroundColor:backgroundColor||"transparent", color:textColor||undefined}}>{backgroundImage ? <img src={backgroundImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15"/> : null}<div className="relative"><div className="mb-6 text-right"><p className="text-xs font-black uppercase text-blue-600">{subtitle}</p><h2 className="text-3xl font-black text-slate-950" style={{color:textColor||undefined}}>{title}</h2>{description ? <p className="mt-2 text-sm font-bold text-slate-500" style={{color:textColor||undefined, opacity:.75}}>{description}</p> : null}</div>{!offers.length?<div className="rounded-3xl border bg-white p-6 text-sm font-bold text-slate-500 shadow-card">{empty}</div>:<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{offers.map((offer)=><MerchantOfferCard key={offer.id} offer={offer}/>)}</div>}</div></div></section>}
function MerchantOfferCard({offer}:{offer:any}){const meta=parseMeta(offer.promotionPackage); const left=daysLeft(offer.endsAt); const originalTotal=Number(offer.originalTotal||0); const rawOfferTotal=Number(offer.offerTotal||meta.bundlePrice||0); const pct=Number(meta.discountPercent||0); const effectiveOfferTotal=pct>0&&originalTotal>0&&(!rawOfferTotal||rawOfferTotal>=originalTotal)?Math.max(0, originalTotal*(1-pct/100)):rawOfferTotal; const save=discount(originalTotal, effectiveOfferTotal); return <Link href={`/offers/${offer.id}`} className="group block overflow-hidden rounded-[2rem] border bg-white shadow-card transition hover:-translate-y-1 hover:shadow-soft"><div className="relative h-56 bg-slate-100">{offer.imageUrl?<img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy"/>:<div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">صورة العرض</div>}<div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/><div className="absolute right-4 top-4 flex gap-2"><Badge className="bg-white/90 text-slate-800">{offer.campaignName||meta.offerType||"عرض"}</Badge>{offer.isPromoted?<Badge className="bg-amber-500 text-white">حصري</Badge>:null}</div>{save? <div className="absolute bottom-4 left-4 rounded-full bg-gradient-to-l from-red-500 to-orange-500 px-3 py-1 text-xs font-black text-white">وفر {save}%</div>:null}</div><div className="p-5 text-right"><h3 className="line-clamp-2 text-xl font-black text-slate-950">{offer.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-500">{offer.description||"عرض خاص من المتجر"}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-500"><span><Store className="ml-1 inline h-4 w-4"/>{offer.storeName}</span>{left!==null?<span><Timer className="ml-1 inline h-4 w-4"/>{left>0?`ينتهي خلال ${left} يوم`:"ينتهي اليوم"}</span>:null}</div><div className="mt-4 flex items-center justify-between"><div>{originalTotal>0?<div className="text-xs font-bold text-slate-400 line-through">{formatNumber(originalTotal)}</div>:null}<div className="text-lg font-black text-primary">{formatNumber(effectiveOfferTotal)}</div></div><span className="text-xs font-black text-blue-600">عرض التفاصيل <ArrowLeft className="inline h-3 w-3"/></span></div></div></Link>}
function AdminOfferCard({offer}:{offer:any}){return <Link href={`/offers/admin-${offer.slug}`} className="group block overflow-hidden rounded-[2rem] border bg-white shadow-card transition hover:-translate-y-1 hover:shadow-soft"><div className="relative h-56 bg-slate-100">{offer.imageUrl?<img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy"/>:null}<div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 to-transparent"/><Badge className="absolute right-4 top-4 bg-blue-600 text-white">{offer.category}</Badge></div><div className="p-5 text-right"><h3 className="text-xl font-black text-slate-950">{offer.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-500">{offer.description||"عرض ترويجي من الإدارة"}</p><div className="mt-4 text-xs font-black text-orange-600">بيانات التواصل والتفاصيل <ArrowLeft className="inline h-3 w-3"/></div></div></Link>}
