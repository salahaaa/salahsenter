"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SponsoredAdTracker } from "@/components/ads/sponsored-ad-tracker";

type Variant = { id: string; label?: string; title?: string; summary?: string; imageUrl?: string | null; linkUrl?: string | null };
type MerchantSponsoredBannerInput = { id: string; adCampaignId: string; adPlacement?: "homepage_marketplace_ads"; title: string; summary?: string; body?: string; imageUrl?: string | null; linkUrl?: string | null; storeName?: string; creativeVariants?: Variant[] };
const visitorKey = "salah_center_ad_visitor";

function stableBucket(value: string, buckets: number) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash) % Math.max(1, buckets);
}

/**
 * Client-side deterministic cohort assignment for merchant-created A/B banner
 * variants. The cohort key stays in browser storage; the API receives only its
 * one-way hash and the selected creative variant id with the ad event.
 */
export function MerchantSponsoredBanner({ item }: { item: MerchantSponsoredBannerInput }) {
  const variants = useMemo(() => (item.creativeVariants || []).filter((variant) => Boolean(variant.id)).slice(0, 3), [item.creativeVariants]);
  const [variantIndex, setVariantIndex] = useState(0);
  useEffect(() => {
    if (variants.length < 2) return;
    try {
      let visitor = window.localStorage.getItem(visitorKey);
      if (!visitor) {
        visitor = globalThis.crypto?.randomUUID?.() || `ad_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        window.localStorage.setItem(visitorKey, visitor);
      }
      setVariantIndex(stableBucket(`${visitor}:${item.adCampaignId}`, variants.length));
    } catch {
      setVariantIndex(0);
    }
  }, [item.adCampaignId, variants.length]);

  const variant = variants[variantIndex] || variants[0];
  const title = variant?.title || item.title;
  const summary = variant?.summary || item.summary || item.body || "عرض مميز من إدارة المول";
  const imageUrl = variant?.imageUrl || item.imageUrl;
  const linkUrl = variant?.linkUrl || item.linkUrl;
  return <SponsoredAdTracker campaignId={item.adCampaignId} placement="homepage_marketplace_ads" creativeVariantId={variant?.id || null}><article className="group relative min-h-[22rem] overflow-hidden rounded-[2rem] border-2 border-amber-300 bg-slate-950 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl md:min-h-[28rem]">{imageUrl ? <img src={imageUrl} alt={title} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" decoding="async" /> : null}<div className="absolute inset-0 bg-gradient-to-t from-slate-950/78 via-slate-950/18 to-transparent" /><div className="absolute inset-y-0 right-0 w-2/3 bg-gradient-to-l from-slate-950/55 via-slate-950/20 to-transparent" /><span className="absolute right-5 top-5 z-10 inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-white shadow-md">★ إعلان تاجر مموّل — {item.storeName}</span>{variants.length > 1 ? <span className="absolute left-5 top-5 z-10 rounded-full border border-white/25 bg-slate-950/50 px-3 py-1 text-xs font-black text-white">A/B · {variant?.label || "A"}</span> : null}<div className="relative flex min-h-[22rem] items-end p-5 text-right md:min-h-[28rem] md:p-9"><div className="max-w-2xl rounded-[1.7rem] border border-white/15 bg-slate-950/42 p-5 text-white shadow-2xl backdrop-blur-md md:p-7"><h3 className="text-3xl font-black leading-tight drop-shadow-lg md:text-5xl">{title}</h3><p className="mt-3 text-sm leading-8 text-white/90 md:text-base">{summary}</p>{linkUrl ? <Button asChild size="lg" className="mt-6 w-fit rounded-2xl bg-gradient-to-l from-amber-500 to-orange-500 text-white"><Link href={linkUrl}>اكتشف العرض <ArrowLeft className="h-4 w-4" /></Link></Button> : null}</div></div></article></SponsoredAdTracker>;
}
