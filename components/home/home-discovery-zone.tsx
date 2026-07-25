"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Compass, Loader2, Search, Sparkles, Store, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber, getInitials } from "@/lib/utils";

type HomeWing = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  heroImageUrl?: string | null;
  desktopImageUrl?: string | null;
  mobileImageUrl?: string | null;
  iconUrl?: string | null;
  storeCount?: number | string | null;
  productCount?: number | string | null;
  ratingAverage?: number | string | null;
  createdAt?: string | Date | null;
};

type SearchResult = {
  id: string;
  type: "wing" | "store";
  title: string;
  subtitle?: string | null;
  href: string;
  imageUrl?: string | null;
  badge?: string | null;
  merchantName?: string | null;
};

type SearchPayload = {
  query: string;
  wings: SearchResult[];
  stores: SearchResult[];
};

export type HomeDiscoveryZoneSettings = {
  displayCount: number;
  rotationIntervalSeconds: number;
  marqueeEnabled: boolean;
  newBadgeDays: number;
};

const fallbackGradients = [
  "from-blue-600 via-cyan-500 to-emerald-400",
  "from-violet-600 via-fuchsia-500 to-rose-400",
  "from-amber-500 via-orange-500 to-red-500",
  "from-slate-900 via-blue-900 to-indigo-700",
  "from-teal-600 via-emerald-500 to-lime-400"
];

export function HomeDiscoveryZone({ wings, title, kicker, description, allButtonLabel, settings }: { wings: HomeWing[]; title: string; kicker: string; description: string; allButtonLabel: string; settings: HomeDiscoveryZoneSettings }) {
  const normalizedWings = useMemo(() => wings.filter((wing) => wing.id && wing.slug && wing.name), [wings]);
  const requestedDisplayCount = Math.max(1, Number(settings.displayCount || 10));
  const displayCount = Math.max(1, Math.min(requestedDisplayCount, normalizedWings.length > 1 ? normalizedWings.length - 1 : 1));
  const pageCount = normalizedWings.length > displayCount ? Math.ceil(normalizedWings.length / displayCount) : 1;
  const [pageIndex, setPageIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (pageIndex >= pageCount) setPageIndex(0);
  }, [pageIndex, pageCount]);

  useEffect(() => {
    if (paused || pageCount <= 1) return;
    const intervalMs = Math.max(5, Number(settings.rotationIntervalSeconds || 30)) * 1000;
    const timer = window.setInterval(() => setPageIndex((current) => (current + 1) % pageCount), intervalMs);
    return () => window.clearInterval(timer);
  }, [pageCount, paused, settings.rotationIntervalSeconds]);

  const visibleWings = useMemo(() => buildCircularPage(normalizedWings, pageIndex * displayCount, displayCount), [displayCount, normalizedWings, pageIndex]);
  const visibleIdKey = visibleWings.map((wing) => wing.id).join("|");
  const marqueeWings = useMemo(() => {
    const visibleIds = new Set(visibleIdKey.split("|").filter(Boolean));
    return normalizedWings
      .filter((wing) => !visibleIds.has(wing.id))
      .sort((a, b) => Number(isNewWing(b, settings.newBadgeDays)) - Number(isNewWing(a, settings.newBadgeDays)) || getTime(b.createdAt) - getTime(a.createdAt));
  }, [normalizedWings, settings.newBadgeDays, visibleIdKey]);

  const canRotate = pageCount > 1;

  return (
    <section className="relative overflow-hidden bg-slate-50 py-16" id="wings-discovery">
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white to-transparent" />
      <div className="relative mx-auto max-w-7xl px-4">
        <DiscoverySearch quickWings={normalizedWings.slice(0, 8)} />

        <div className="mt-10 rounded-[2.2rem] border border-white/80 bg-white/80 p-4 shadow-card backdrop-blur-xl md:p-6">
          <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="order-2 flex flex-wrap items-center gap-3 lg:order-1">
              <Button asChild variant="outline" className="rounded-2xl bg-white px-7"><Link href="/wings">{allButtonLabel}</Link></Button>
              <div className="flex rounded-2xl border bg-white p-1 shadow-sm">
                <button type="button" onClick={() => setPageIndex((current) => (current - 1 + pageCount) % Math.max(pageCount, 1))} disabled={!canRotate} className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 disabled:opacity-40" aria-label="المجموعة السابقة"><ChevronRight className="h-5 w-5" /></button>
                <button type="button" onClick={() => setPageIndex((current) => (current + 1) % Math.max(pageCount, 1))} disabled={!canRotate} className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 disabled:opacity-40" aria-label="المجموعة التالية"><ChevronLeft className="h-5 w-5" /></button>
              </div>
              <Badge variant="outline" className="bg-white">{formatNumber(pageIndex + 1)} / {formatNumber(Math.max(pageCount, 1))}</Badge>
            </div>
            <div className="order-1 text-right lg:order-2">
              <div className="text-sm font-black uppercase tracking-wide text-amber-500">{kicker}</div>
              <h2 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">{title}</h2>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-slate-500 md:text-base">{description}</p>
            </div>
          </div>

          {settings.marqueeEnabled && marqueeWings.length ? <WingsMarquee wings={marqueeWings} newBadgeDays={settings.newBadgeDays} /> : null}

          <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} className="mt-7">
            <div key={pageIndex} className="grid animate-in fade-in-50 slide-in-from-bottom-3 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {visibleWings.map((wing, index) => <RotatingWingCard key={wing.id} wing={wing} index={index} isNew={isNewWing(wing, settings.newBadgeDays)} />)}
            </div>
            {canRotate ? (
              <div className="mt-6 flex items-center justify-center gap-2">
                {Array.from({ length: pageCount }).map((_, index) => (
                  <button key={index} type="button" onClick={() => setPageIndex(index)} className={cn("h-2.5 rounded-full transition-all", index === pageIndex ? "w-10 bg-slate-950" : "w-2.5 bg-slate-300 hover:bg-slate-400")} aria-label={`عرض مجموعة الأجنحة ${index + 1}`} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function DiscoverySearch({ quickWings }: { quickWings: HomeWing[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<SearchPayload | null>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) {
      setPayload(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/search/home?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const json = await response.json();
        if (!controller.signal.aborted) setPayload(json.success ? json.data : { query: trimmed, wings: [], stores: [] });
      } catch {
        if (!controller.signal.aborted) setPayload({ query: trimmed, wings: [], stores: [] });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed]);

  const hasResults = Boolean(payload && (payload.wings.length || payload.stores.length));

  return (
    <div className="relative mx-auto max-w-5xl">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-slate-950 p-1 shadow-2xl shadow-slate-900/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,.22),transparent_30%),radial-gradient(circle_at_90%_20%,rgba(59,130,246,.22),transparent_30%)]" />
        <div className="relative rounded-[1.8rem] bg-white p-4 md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/20"><Search className="h-7 w-7" /></div>
            <div className="min-w-0 flex-1 text-right">
              <label htmlFor="home-smart-search" className="text-sm font-black text-slate-950">بحث سريع عن جناح أو متجر أو اسم تاجر</label>
              <div className="mt-2 flex items-center rounded-2xl border bg-slate-50 px-4 py-3 transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
                <input
                  id="home-smart-search"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
                  onFocus={() => setOpen(true)}
                  placeholder="مثال: إلكترونيات، عطور، اسم متجر، اسم تاجر..."
                  className="w-full bg-transparent text-right text-sm font-bold outline-none md:text-base"
                />
                {loading ? <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> : <Sparkles className="h-5 w-5 text-amber-500" />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+12px)] z-30 overflow-hidden rounded-[1.7rem] border bg-white shadow-2xl">
          {trimmed.length < 2 ? (
            <div className="p-5 text-right">
              <p className="font-black text-slate-950">اكتب حرفين على الأقل للبحث الفوري</p>
              <p className="mt-1 text-sm text-slate-500">أو اختر من الأجنحة السريعة التالية:</p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {quickWings.map((wing) => <Link key={wing.id} href={`/wings/${wing.slug}`} className="rounded-full border bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">{wing.name}</Link>)}
              </div>
            </div>
          ) : hasResults ? (
            <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-x-reverse md:divide-y-0">
              <SearchGroup title="الأجنحة" icon={<Compass className="h-5 w-5" />} items={payload?.wings || []} onPick={() => setOpen(false)} />
              <SearchGroup title="المتاجر والتجار" icon={<Store className="h-5 w-5" />} items={payload?.stores || []} onPick={() => setOpen(false)} />
            </div>
          ) : (
            <div className="p-6 text-center">
              <Wand2 className="mx-auto mb-3 h-9 w-9 text-slate-300" />
              <p className="font-black text-slate-800">لا توجد نتائج مطابقة</p>
              <p className="mt-1 text-sm text-slate-500">جرّب كلمة أقصر أو ابحث باسم الجناح أو المتجر.</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SearchGroup({ title, icon, items, onPick }: { title: string; icon: React.ReactNode; items: SearchResult[]; onPick: () => void }) {
  return (
    <div className="p-4 text-right">
      <div className="mb-3 flex items-center justify-end gap-2 font-black text-slate-950">{title} {icon}</div>
      <div className="space-y-2">
        {items.length ? items.map((item) => (
          <Link key={`${item.type}-${item.id}`} href={item.href} onClick={onPick} className="flex items-center gap-3 rounded-2xl p-3 transition hover:bg-slate-50">
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 text-sm font-black text-slate-500">
              {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : getInitials(item.title).slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-slate-900">{item.title}</p>
              <p className="truncate text-xs leading-5 text-slate-500">{item.subtitle || item.merchantName || item.badge}</p>
            </div>
            <ArrowLeft className="h-4 w-4 shrink-0 text-blue-500" />
          </Link>
        )) : <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-400">لا توجد نتائج في هذا القسم</p>}
      </div>
    </div>
  );
}

function WingsMarquee({ wings, newBadgeDays }: { wings: HomeWing[]; newBadgeDays: number }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0, moved: false });
  const marqueeItems = wings.length > 6 ? [...wings, ...wings] : wings;

  return (
    <div className="rounded-[1.7rem] border bg-slate-950 p-3 text-white shadow-inner">
      <div className="mb-3 flex items-center justify-between gap-3 px-2 text-xs font-black text-white/70">
        <span>اسحب الشريط يميناً ويساراً أو اتركه يتحرك تلقائياً</span>
        <span className="inline-flex items-center gap-2 text-amber-300"><Sparkles className="h-4 w-4" /> أجنحة إضافية</span>
      </div>
      <div
        ref={scrollerRef}
        className="wing-marquee-scroll overflow-x-auto overscroll-x-contain rounded-2xl pb-1"
        onPointerDown={(event) => {
          const node = scrollerRef.current;
          if (!node) return;
          drag.current = { active: true, startX: event.clientX, scrollLeft: node.scrollLeft, moved: false };
          node.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const node = scrollerRef.current;
          if (!node || !drag.current.active) return;
          const delta = event.clientX - drag.current.startX;
          if (Math.abs(delta) > 4) drag.current.moved = true;
          node.scrollLeft = drag.current.scrollLeft - delta;
        }}
        onPointerUp={(event) => {
          scrollerRef.current?.releasePointerCapture?.(event.pointerId);
          drag.current.active = false;
        }}
        onPointerCancel={() => { drag.current.active = false; }}
      >
        <div className="wing-marquee-track flex w-max gap-3 px-1">
          {marqueeItems.map((wing, index) => <MiniWingBadge key={`${wing.id}-${index}`} wing={wing} isNew={isNewWing(wing, newBadgeDays)} />)}
          <AllWingsMarqueeButton />
        </div>
      </div>
    </div>
  );
}

function MiniWingBadge({ wing, isNew }: { wing: HomeWing; isNew: boolean }) {
  return (
    <Link href={`/wings/${wing.slug}`} prefetch={false} className="group flex min-w-[220px] items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 text-right backdrop-blur transition hover:bg-white hover:text-slate-950">
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/10 text-sm font-black text-white group-hover:bg-slate-100 group-hover:text-slate-700">
        {wing.iconUrl || wing.heroImageUrl ? <img src={wing.iconUrl || wing.heroImageUrl || ""} alt={wing.name} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : getInitials(wing.name).slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-end gap-2">
          {isNew ? <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-slate-950">جديد</span> : null}
          <p className="truncate text-sm font-black">{wing.name}</p>
        </div>
        <p className="mt-1 truncate text-xs text-white/55 group-hover:text-slate-500">{wing.description || "اكتشف المتاجر"}</p>
      </div>
    </Link>
  );
}

function AllWingsMarqueeButton() {
  return (
    <Link href="/wings" prefetch={false} className="group flex min-w-[230px] items-center justify-center gap-3 rounded-2xl border border-amber-300/60 bg-gradient-to-l from-amber-400 to-orange-500 px-5 py-3 text-right font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:scale-[1.02] hover:shadow-xl">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/85 text-orange-600"><Compass className="h-6 w-6" /></span>
      <span className="flex flex-col leading-6">
        <span className="text-sm">لا تنتظر الشريط</span>
        <span className="inline-flex items-center gap-1 text-base">كل الأجنحة <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" /></span>
      </span>
    </Link>
  );
}

function RotatingWingCard({ wing, index, isNew }: { wing: HomeWing; index: number; isNew: boolean }) {
  const image = wing.heroImageUrl || wing.desktopImageUrl || wing.mobileImageUrl;
  const gradient = fallbackGradients[index % fallbackGradients.length];
  return (
    <Link href={`/wings/${wing.slug}`} prefetch={false} className="group relative overflow-hidden rounded-[2rem] border bg-white text-right shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-2xl">
      <div className={cn("relative h-64 overflow-hidden bg-gradient-to-br", gradient)}>
        {image ? <img src={image} alt={wing.name} className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
        <div className="absolute right-5 top-5 flex flex-wrap gap-2">
          {isNew ? <Badge className="bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20">جديد</Badge> : null}
          <Badge className="bg-white/20 text-white backdrop-blur">جناح تجاري</Badge>
        </div>
        <div className="absolute bottom-5 right-5 left-5 text-white">
          <h3 className="text-2xl font-black md:text-3xl">{wing.name}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/75">{wing.description || "مجموعة مختارة من المتاجر والمنتجات داخل هذا الجناح"}</p>
        </div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <WingStat label="متاجر" value={formatNumber(wing.storeCount || 0)} />
          <WingStat label="منتجات" value={formatNumber(wing.productCount || 0)} />
          <WingStat label="تقييم" value={formatNumber(wing.ratingAverage || 0)} />
        </div>
        <div className="mt-5 flex items-center justify-between text-sm font-black text-primary">
          <span className="inline-flex items-center gap-1">تصفح الجناح <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" /></span>
          <span className="text-slate-400">#{String(index + 1).padStart(2, "0")}</span>
        </div>
      </div>
    </Link>
  );
}

function WingStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-lg font-black text-slate-950">{value}</p><p className="mt-1 text-[11px] font-bold text-slate-400">{label}</p></div>;
}

function buildCircularPage<T>(items: T[], startIndex: number, size: number) {
  if (!items.length) return [];
  const count = Math.min(size, items.length);
  return Array.from({ length: count }, (_, offset) => items[(startIndex + offset) % items.length]);
}

function getTime(value?: string | Date | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isNewWing(wing: HomeWing, days = 14) {
  const created = getTime(wing.createdAt);
  if (!created) return false;
  return Date.now() - created <= Math.max(1, days) * 24 * 60 * 60 * 1000;
}
