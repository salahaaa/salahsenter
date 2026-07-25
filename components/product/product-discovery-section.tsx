"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Boxes, Loader2, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CurrencyPrice } from "@/components/currency/currency-price";
import { ProductCompareButton } from "@/components/product/product-compare-button";
import type { StoreCurrencySettings } from "@/lib/currency-shared";
import { trackFunnelEvent } from "@/lib/funnel-client";

type DiscoveryProduct = {
  id: string;
  name: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  storeLogoUrl: string | null;
  imageUrl: string | null;
  minPrice: string | null;
  ratingAverage: string | number;
  ratingCount: number;
  inStock: boolean;
  confidence: "exact" | "strong" | "similar" | "weak";
  reasons: string[];
  href: string;
};

type Discovery = {
  similarProducts: DiscoveryProduct[];
  sameItemStores: DiscoveryProduct[];
  alternativeStores: DiscoveryProduct[];
  insight: string | null;
};

function confidenceLabel(confidence: DiscoveryProduct["confidence"]) {
  if (confidence === "exact") return "تطابق مؤكد";
  if (confidence === "strong") return "تطابق قوي";
  if (confidence === "similar") return "بديل مشابه";
  return "تشابه مبدئي";
}

export function ProductDiscoverySection({ productId, storeId, currencySettings }: { productId: string; storeId: string; currencySettings: StoreCurrencySettings }) {
  const [data, setData] = useState<Discovery | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/products/${productId}/discovery`, { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => { if (active) setData(json.success ? json.data : null); })
      .catch(() => { if (active) setData(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId]);

  if (loading) return <section className="mt-8 rounded-[2rem] border bg-white p-6 shadow-card"><div className="flex items-center gap-2 text-sm font-black text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> جارٍ استكشاف بدائل ومحلات قريبة...</div></section>;
  if (!data || (!data.similarProducts.length && !data.sameItemStores.length && !data.alternativeStores.length)) return null;

  return <section className="mt-8 space-y-6">
    {data.insight ? <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900">{data.insight}</p> : null}
    {data.sameItemStores.length ? <DiscoveryGroup title="محلات تبيع نفس الصنف" subtitle="تطابق باركود أو اسم وعلامة تجارية بدرجة قوية" icon={<Store className="h-5 w-5" />} products={data.sameItemStores} productId={productId} currentStoreId={storeId} currencySettings={currencySettings} eventSource="same_item_store" /> : null}
    {data.alternativeStores.length ? <DiscoveryGroup title="بدائل قريبة من محلات أخرى" subtitle="بدائل مشابهة؛ تحقق من المواصفات قبل الشراء" icon={<Boxes className="h-5 w-5" />} products={data.alternativeStores} productId={productId} currentStoreId={storeId} currencySettings={currencySettings} eventSource="alternative_store" /> : null}
    {data.similarProducts.length ? <DiscoveryGroup title="أصناف مشابهة قد تعجبك" subtitle="اقتراحات قابلة للتفسير بحسب الاسم والعلامة والفئة والتوفر" icon={<BadgeCheck className="h-5 w-5" />} products={data.similarProducts} productId={productId} currentStoreId={storeId} currencySettings={currencySettings} eventSource="similar_product" /> : null}
  </section>;
}

function DiscoveryGroup({ title, subtitle, icon, products, productId, currentStoreId, currencySettings, eventSource }: { title: string; subtitle: string; icon: React.ReactNode; products: DiscoveryProduct[]; productId: string; currentStoreId: string; currencySettings: StoreCurrencySettings; eventSource: string }) {
  return <section className="rounded-[2rem] border bg-white p-6 shadow-card">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-black text-slate-950">{icon} {title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p></div><Badge variant="outline">{products.length} نتائج</Badge></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{products.map((item) => <article key={item.id} className="overflow-hidden rounded-2xl border bg-slate-50 transition hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-50 hover:shadow-card">
      <Link href={item.href} onClick={() => trackFunnelEvent({ eventType: "product_recommendation_click", storeId: item.storeId, productId: item.id, metadata: { source: eventSource, originProductId: productId, originStoreId: currentStoreId, confidence: item.confidence } })} className="group block">
        <div className="flex gap-3 p-3"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white">{item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full place-items-center text-xs font-black text-slate-400">بديل</div>}</div><div className="min-w-0 flex-1 text-right"><p className="line-clamp-2 font-black text-slate-950">{item.name}</p><p className="mt-1 truncate text-xs font-bold text-slate-500">{item.storeName}</p><div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs font-black text-amber-600">★ {Number(item.ratingAverage || 0).toFixed(1)}</span>{item.minPrice ? <CurrencyPrice amount={item.minPrice} settings={currencySettings} className="text-sm font-black text-primary" /> : <span className="text-xs font-bold text-slate-500">حسب المتغير</span>}</div></div><ArrowLeft className="mt-7 h-4 w-4 shrink-0 text-blue-500 transition group-hover:-translate-x-1" /></div>
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-white px-3 py-2"><span className={`text-[11px] font-black ${item.inStock ? "text-emerald-700" : "text-slate-500"}`}>{item.inStock ? "متوفر" : "تحقق من التوفر"}</span><div className="flex flex-wrap justify-end gap-1"><Badge variant={item.confidence === "exact" ? "success" : item.confidence === "strong" ? "warning" : "outline"}>{confidenceLabel(item.confidence)}</Badge>{item.reasons.slice(0, 1).map((reason) => <span key={reason} className="text-[10px] font-bold text-slate-500">{reason}</span>)}</div><ProductCompareButton productId={productId} withProductId={item.id} compact /></div>
    </article>)}</div>
  </section>;
}
