import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SponsoredAdTracker } from "@/components/ads/sponsored-ad-tracker";
import type { HomeExposureCard, HomepageExposurePlacement } from "@/lib/home-exposure";

type Props = { placement: HomepageExposurePlacement; cards?: HomeExposureCard[]; label?: string };

/** Clearly labelled, separately ranked paid inventory. It never mutates organic lists. */
export function HomeExposureSlot({ placement, cards = [], label = "مساحة تجارية" }: Props) {
  if (!cards.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pb-2 pt-7" data-home-exposure-placement={placement}>
      <div className="mb-3 flex items-center justify-between gap-3 text-right">
        <div><Badge className="bg-amber-100 text-amber-900">إعلان ممول</Badge><p className="mt-2 text-sm font-black text-slate-800">{label}</p></div>
        <p className="text-xs font-bold text-slate-500">تظهر وفق الجدولة والعدالة وحدود الحملة</p>
      </div>
      <div className={`grid gap-4 ${cards.length > 1 ? "md:grid-cols-2" : ""}`}>
        {cards.map((card) => <SponsoredAdTracker key={card.campaignId} campaignId={card.campaignId} placement={placement} creativeVariantId={card.creativeVariantId}><Link href={card.linkUrl} prefetch={false} className="group relative block min-h-44 overflow-hidden rounded-3xl border-2 border-amber-200 bg-slate-950 text-white shadow-card transition hover:-translate-y-1 hover:border-amber-400 hover:shadow-xl"><>{card.imageUrl ? <img src={card.imageUrl} alt={card.title} className="absolute inset-0 h-full w-full object-cover opacity-50 transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" /> : null}<div className="absolute inset-0 bg-gradient-to-l from-slate-950 via-slate-950/75 to-slate-950/20" /><div className="relative flex min-h-44 flex-col justify-end p-5 text-right"><span className="mb-3 w-fit rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-slate-950">إعلان ممول · {card.storeName}</span><h3 className="max-w-2xl text-xl font-black">{card.title}</h3><p className="mt-2 max-w-2xl line-clamp-2 text-sm font-semibold leading-6 text-white/80">{card.description}</p></div></></Link></SponsoredAdTracker>)}
      </div>
    </section>
  );
}
