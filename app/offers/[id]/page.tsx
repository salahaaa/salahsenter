export const revalidate = 120;

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, ExternalLink, MapPin, MessageCircle, Phone, Store, Tag } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OfferCheckoutPanel } from "@/components/offers/offer-checkout-panel";
import { getCachedPublicOfferDetail } from "@/lib/cache/public-offer-detail-cache";
import { formatNumber } from "@/lib/utils";

function parseMeta(raw?: string | null) { try { return raw ? JSON.parse(raw) as Record<string, any> : {}; } catch { return {}; } }
function savePercent(items: Array<{ originalPrice: string | null; offerPrice: string | null; quantity?: number | null }>) { const original=items.reduce((s,i)=>s+Number(i.originalPrice||0)*Number(i.quantity||1),0); const offer=items.reduce((s,i)=>s+Number(i.offerPrice||0)*Number(i.quantity||1),0); return original>0&&offer>0&&offer<original?Math.round(((original-offer)/original)*100):0; }

export default async function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCachedPublicOfferDetail(id);
  if (!data) notFound();

  if (data.kind === "admin") {
    const offer = data.offer;
    return <main className="min-h-screen bg-slate-50"><SiteHeader/><section className="container py-8"><Button asChild variant="outline" className="mb-6"><Link href="/offers"><ArrowRight className="h-4 w-4"/> العودة للعروض</Link></Button><div className="overflow-hidden rounded-[2rem] border bg-white shadow-card"><div className="relative h-80 bg-slate-100 md:h-[460px]">{offer.imageUrl?<img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-cover"/>:null}<div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent"/><div className="absolute bottom-8 right-8 left-8 text-right text-white"><Badge className="mb-4 bg-blue-600 text-white">{offer.category}</Badge><h1 className="text-4xl font-black md:text-6xl">{offer.title}</h1><p className="mt-4 max-w-3xl text-sm leading-8 text-white/75">{offer.description}</p></div></div><div className="grid gap-6 p-6 md:grid-cols-[1fr_360px]"><div className="space-y-4 text-right"><h2 className="text-2xl font-black">تفاصيل العرض الترويجي</h2><p className="leading-8 text-slate-600">{offer.description || "عرض ترويجي من إدارة المنصة."}</p>{offer.videoUrl?<a href={offer.videoUrl} target="_blank" className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-black text-red-600"><ExternalLink className="h-4 w-4"/> مشاهدة الفيديو</a>:null}</div><aside className="rounded-3xl bg-slate-50 p-5 text-right"><h3 className="font-black">بيانات التواصل</h3><div className="mt-4 space-y-3 text-sm font-bold text-slate-600">{offer.contactName?<p><Store className="ml-1 inline h-4 w-4"/>{offer.contactName}</p>:null}{offer.contactPhone?<p><Phone className="ml-1 inline h-4 w-4"/>{offer.contactPhone}</p>:null}{offer.locationText?<p><MapPin className="ml-1 inline h-4 w-4"/>{offer.locationText}</p>:null}</div><div className="mt-5 grid gap-2">{offer.whatsappUrl?<Button asChild className="rounded-2xl bg-emerald-600 hover:bg-emerald-700"><a href={offer.whatsappUrl} target="_blank"><MessageCircle className="h-4 w-4"/> واتساب</a></Button>:null}{offer.externalUrl?<Button asChild variant="outline" className="rounded-2xl"><a href={offer.externalUrl} target="_blank"><ExternalLink className="h-4 w-4"/> فتح الرابط</a></Button>:null}</div></aside></div></div></section><Footer/></main>;
  }

  const { offer, store, campaign, items } = data;
  const meta = parseMeta(offer.promotionPackage);
  const discountPercent = Number(meta.discountPercent || 0);
  const effectiveItems = items.map((item) => {
    const original = Number(item.originalPrice || 0);
    const current = Number(item.offerPrice || 0);
    const effective = discountPercent > 0 && original > 0 && (!current || current >= original) ? Math.max(0, original * (1 - discountPercent / 100)) : current;
    return { ...item, offerPrice: String(effective) };
  });
  const percent = savePercent(effectiveItems);
  return <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#fff7ed_45%,#f8fafc_100%)]"><SiteHeader/><section className="container py-8"><Button asChild variant="outline" className="mb-6"><Link href="/offers"><ArrowRight className="h-4 w-4"/> العودة للعروض</Link></Button><div className="grid gap-7 lg:grid-cols-[1fr_390px]"><div className="overflow-hidden rounded-[2rem] border bg-white shadow-card"><div className="relative h-80 bg-slate-100 md:h-[440px]">{offer.imageUrl?<img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-cover"/>:null}<div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent"/><div className="absolute bottom-8 right-8 left-8 text-right text-white"><div className="mb-4 flex flex-wrap gap-2"><Badge className="bg-amber-500 text-white">{campaign?.name || meta.offerType || "عرض"}</Badge>{percent?<Badge className="bg-red-500 text-white">وفر {percent}%</Badge>:null}</div><h1 className="text-4xl font-black md:text-6xl">{offer.title}</h1><p className="mt-4 max-w-3xl text-sm leading-8 text-white/75">{offer.description}</p></div></div><div className="p-6 text-right"><div className="flex flex-wrap items-center gap-3 text-sm font-bold text-slate-500"><span><Store className="ml-1 inline h-4 w-4"/>{store.name}</span>{offer.endsAt?<span><CalendarDays className="ml-1 inline h-4 w-4"/> ينتهي {new Intl.DateTimeFormat("ar").format(offer.endsAt)}</span>:null}<span><Tag className="ml-1 inline h-4 w-4"/> {effectiveItems.reduce((sum, item) => sum + Number(item.quantity || 1), 0)} قطعة</span></div><h2 className="mt-8 text-2xl font-black">المنتجات داخل العرض</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{effectiveItems.map((item)=><Link href={`/store/${store.slug}/products/${item.productSlug}`} key={item.id} className="flex gap-3 rounded-2xl border bg-slate-50 p-3 transition hover:bg-white hover:shadow-soft"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white">{(item.imageUrl||item.productImageUrl)?<img src={item.imageUrl||item.productImageUrl||""} alt="" className="h-full w-full object-cover"/>:null}</div><div className="min-w-0 flex-1"><h3 className="line-clamp-2 font-black text-slate-950">{item.title || item.productName}</h3><div className="mt-1 text-xs font-bold text-slate-500">الكمية داخل العرض: {item.quantity || 1}</div><div className="mt-2 text-sm"><span className="font-black text-primary">{formatNumber(Number(item.offerPrice||0))}</span>{item.originalPrice?<span className="mr-2 text-xs font-bold text-slate-400 line-through">{formatNumber(Number(item.originalPrice))}</span>:null}</div></div></Link>)}</div></div></div><OfferCheckoutPanel storeId={store.id} storeSlug={store.slug} storeName={store.name} offerProduct={data.offerProduct}/></div></section><Footer/></main>;
}
