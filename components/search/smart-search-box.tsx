"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Box, Building2, Compass, Loader2, Search, Sparkles, Store, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatNumber, getInitials } from "@/lib/utils";
import { SponsoredAdTracker } from "@/components/ads/sponsored-ad-tracker";

type SmartSearchResponse = {
  query: string;
  correctedQuery: string;
  suggestions: string[];
  sponsoredProducts?: Array<{
    id: string;
    name: string;
    href: string;
    imageUrl: string | null;
    price: string | null;
    storeName: string;
    ratingAverage: string | number | null;
    adCampaignId: string;
    adPlacement: "search_results";
  }>;
  products: Array<{
    id: string;
    type: "product";
    name: string;
    href: string;
    imageUrl: string | null;
    price: string | null;
    storeName: string;
    categoryName: string | null;
    wingName: string | null;
    ratingAverage: string | number | null;
    matchReason: string;
  }>;
  stores: Array<{
    id: string;
    type: "store";
    name: string;
    href: string;
    logoUrl: string | null;
    coverImageUrl: string | null;
    ratingAverage: string | number | null;
    orderCount: number | null;
    merchantName: string;
    wingName: string | null;
    location: string;
    matchReason: string;
  }>;
  wings: Array<{
    id: string;
    type: "wing";
    name: string;
    href: string;
    imageUrl: string | null;
    description: string | null;
    storeCount: number;
    productCount: number;
    isNew: boolean;
    matchReason: string;
  }>;
  categories: Array<{
    id: string;
    type: "category";
    name: string;
    href: string;
    imageUrl: string | null;
    storeName: string;
    productCount: number;
    matchReason: string;
  }>;
};

export function SmartSearchBox({ variant = "header", placeholder = "ابحث باسم المنتج أو المتجر أو التصنيف..." }: { variant?: "header" | "hero"; placeholder?: string }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SmartSearchResponse | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trimmed = query.trim();

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (!open) return;
      try {
        setLoading(Boolean(trimmed));
        const response = await fetch(`/api/search/advanced?q=${encodeURIComponent(trimmed)}&limit=7&source=instant_search`, { signal: controller.signal });
        const json = await response.json();
        if (!controller.signal.aborted) setData(json.success ? json.data : null);
      } catch {
        if (!controller.signal.aborted) setData(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, trimmed ? 160 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed, open]);

  const hasResults = Boolean(data && (data.products.length || data.sponsoredProducts?.length || data.stores.length || data.wings.length || data.categories.length));
  const corrected = data?.correctedQuery && trimmed && data.correctedQuery !== trimmed ? data.correctedQuery : null;
  const suggestions = useMemo(() => data?.suggestions?.slice(0, 8) || ["منتجات مميزة", "عروض اليوم", "متاجر موثوقة", "الأكثر طلباً"], [data?.suggestions]);

  return (
    <div ref={containerRef} className={cn("relative", variant === "hero" ? "w-full" : "w-full") }>
      <div className={cn("flex items-center rounded-2xl border transition focus-within:ring-4", variant === "hero" ? "h-14 border-slate-200 bg-slate-50 px-4 focus-within:border-blue-300 focus-within:bg-white focus-within:ring-blue-100" : "h-12 border-white/70 bg-white/70 px-4 shadow-sm backdrop-blur focus-within:border-blue-300 focus-within:ring-blue-100") }>
        <Search className="h-5 w-5 shrink-0 text-blue-500" />
        <input
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent px-3 text-right text-sm font-bold text-slate-800 outline-none placeholder:text-slate-400"
        />
        {loading ? <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> : <Sparkles className="h-5 w-5 text-amber-500" />}
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 max-h-[78vh] overflow-hidden rounded-[1.7rem] border bg-white shadow-2xl">
          <div className="border-b bg-gradient-to-l from-slate-950 to-slate-800 p-4 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-black"><Sparkles className="h-4 w-4 text-amber-300" /> بحث ذكي موحد</div>
              {corrected ? <button type="button" onClick={() => setQuery(corrected)} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-amber-200">هل تقصد: {corrected}؟</button> : null}
            </div>
          </div>

          <div className="max-h-[calc(78vh-58px)] overflow-y-auto p-4">
            {!trimmed ? (
              <SuggestionsView suggestions={suggestions} onPick={(value) => { setQuery(value); setOpen(true); }} />
            ) : hasResults ? (
              <div className="space-y-5">
                <ResultSection title="إعلانات ممولة" icon={<Sparkles className="h-5 w-5" />} count={data?.sponsoredProducts?.length || 0}>
                  <div className="grid gap-3 md:grid-cols-2">{data?.sponsoredProducts?.map((product) => <SponsoredProductResult key={`${product.adCampaignId}:${product.id}`} product={product} onPick={() => setOpen(false)} />)}</div>
                </ResultSection>
                <ResultSection title="المنتجات" icon={<Box className="h-5 w-5" />} count={data?.products.length || 0}>
                  <div className="grid gap-3 md:grid-cols-2">
                    {data?.products.map((product) => <ProductResult key={product.id} product={product} onPick={() => setOpen(false)} />)}
                  </div>
                </ResultSection>
                <div className="grid gap-5 lg:grid-cols-3">
                  <ResultSection title="المتاجر" icon={<Store className="h-5 w-5" />} count={data?.stores.length || 0}>{data?.stores.map((store) => <StoreResult key={store.id} store={store} onPick={() => setOpen(false)} />)}</ResultSection>
                  <ResultSection title="الأجنحة" icon={<Compass className="h-5 w-5" />} count={data?.wings.length || 0}>{data?.wings.map((wing) => <WingResult key={wing.id} wing={wing} onPick={() => setOpen(false)} />)}</ResultSection>
                  <ResultSection title="التصنيفات" icon={<Tags className="h-5 w-5" />} count={data?.categories.length || 0}>{data?.categories.map((category) => <CategoryResult key={category.id} category={category} onPick={() => setOpen(false)} />)}</ResultSection>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <Search className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="font-black text-slate-800">لا توجد نتائج دقيقة</p>
                <p className="mt-1 text-sm text-slate-500">جرّب كلمة أقصر، اسم منتج، اسم متجر، أو وصف الاستخدام.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SuggestionsView({ suggestions, onPick }: { suggestions: string[]; onPick: (value: string) => void }) {
  return (
    <div className="text-right">
      <p className="font-black text-slate-950">اقتراحات ذكية قبل البحث</p>
      <p className="mt-1 text-sm text-slate-500">منتجات ومتاجر وتصنيفات شائعة للوصول السريع.</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => onPick(suggestion)} className="rounded-full border bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">{suggestion}</button>)}
      </div>
    </div>
  );
}

function ResultSection({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <section className="text-right">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Badge variant="outline">{formatNumber(count)}</Badge>
        <h3 className="flex items-center gap-2 font-black text-slate-950">{title} {icon}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ProductResult({ product, onPick }: { product: SmartSearchResponse["products"][number]; onPick: () => void }) {
  return (
    <Link href={product.href} onClick={onPick} className="group flex gap-3 rounded-2xl border bg-slate-50 p-3 transition hover:border-blue-100 hover:bg-blue-50">
      <Thumb src={product.imageUrl} title={product.name} />
      <div className="min-w-0 flex-1 text-right">
        <p className="line-clamp-1 font-black text-slate-950">{product.name}</p>
        <p className="mt-1 truncate text-xs font-bold text-slate-500">{product.storeName} {product.wingName ? `• ${product.wingName}` : ""}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="font-black text-primary">{product.price ? formatCurrency(product.price) : "حسب المتغير"}</span>
          <span className="text-xs font-bold text-amber-500">★ {formatNumber(product.ratingAverage || 0)}</span>
        </div>
      </div>
      <ArrowLeft className="mt-5 h-4 w-4 shrink-0 text-blue-500 transition group-hover:-translate-x-1" />
    </Link>
  );
}

function SponsoredProductResult({ product, onPick }: { product: NonNullable<SmartSearchResponse["sponsoredProducts"]>[number]; onPick: () => void }) {
  return <SponsoredAdTracker campaignId={product.adCampaignId} placement="search_results" productId={product.id}><Link href={product.href} onClick={onPick} className="group flex gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-3 transition hover:border-amber-400 hover:bg-amber-50"><Thumb src={product.imageUrl} title={product.name} /><div className="min-w-0 flex-1 text-right"><div className="flex items-center justify-between gap-2"><Badge className="bg-amber-400 text-slate-950">إعلان ممول</Badge><p className="line-clamp-1 font-black text-slate-950">{product.name}</p></div><p className="mt-1 truncate text-xs font-bold text-slate-500">{product.storeName}</p><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="font-black text-primary">{product.price ? formatCurrency(product.price) : "حسب المتغير"}</span><span className="text-xs font-bold text-amber-500">★ {formatNumber(product.ratingAverage || 0)}</span></div></div><ArrowLeft className="mt-5 h-4 w-4 shrink-0 text-amber-600 transition group-hover:-translate-x-1" /></Link></SponsoredAdTracker>;
}

function StoreResult({ store, onPick }: { store: SmartSearchResponse["stores"][number]; onPick: () => void }) {
  return <CompactResult href={store.href} imageUrl={store.logoUrl || store.coverImageUrl} title={store.name} subtitle={`${store.merchantName} • ★ ${formatNumber(store.ratingAverage || 0)}`} onPick={onPick} />;
}
function WingResult({ wing, onPick }: { wing: SmartSearchResponse["wings"][number]; onPick: () => void }) {
  return <CompactResult href={wing.href} imageUrl={wing.imageUrl} title={wing.name} subtitle={`${formatNumber(wing.storeCount)} متجر • ${formatNumber(wing.productCount)} منتج`} badge={wing.isNew ? "جديد" : undefined} onPick={onPick} />;
}
function CategoryResult({ category, onPick }: { category: SmartSearchResponse["categories"][number]; onPick: () => void }) {
  return <CompactResult href={category.href} imageUrl={category.imageUrl} title={category.name} subtitle={`${category.storeName} • ${formatNumber(category.productCount)} منتج`} onPick={onPick} />;
}

function CompactResult({ href, imageUrl, title, subtitle, badge, onPick }: { href: string; imageUrl?: string | null; title: string; subtitle?: string; badge?: string; onPick: () => void }) {
  return (
    <Link href={href} onClick={onPick} className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-slate-50">
      <Thumb src={imageUrl} title={title} small />
      <div className="min-w-0 flex-1 text-right">
        <div className="flex items-center justify-end gap-2">{badge ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">{badge}</span> : null}<p className="truncate font-black text-slate-900">{title}</p></div>
        {subtitle ? <p className="mt-1 truncate text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <ArrowLeft className="h-4 w-4 shrink-0 text-blue-500" />
    </Link>
  );
}

function Thumb({ src, title, small = false }: { src?: string | null; title: string; small?: boolean }) {
  return (
    <div className={cn("grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-white text-slate-400 shadow-sm", small ? "h-11 w-11" : "h-16 w-16")}>
      {src ? <img src={src} alt={title} className="h-full w-full object-cover" loading="lazy" /> : <span className="font-black">{getInitials(title).slice(0, 1)}</span>}
    </div>
  );
}

export function SmartSearchLaunchButton({ label = "البحث الذكي" }: { label?: string }) {
  const [mounted, setMounted] = useState(false);
  return (
    <div className="relative w-full">
      {!mounted ? <Button type="button" variant="outline" onClick={() => setMounted(true)} className="w-full"><Search className="h-4 w-4" /> {label}</Button> : <SmartSearchBox variant="hero" />}
    </div>
  );
}

export function SmartSearchFeatureBadge() {
  return <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700"><Building2 className="h-3.5 w-3.5" /> Smart Mall Search</span>;
}
