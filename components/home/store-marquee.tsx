"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowLeft, Sparkles, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatNumber, getInitials } from "@/lib/utils";

type StoreItem = {
  id?: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  ratingAverage?: string | number | null;
  orderCount?: string | number | null;
  cityName?: string | null;
  governorateName?: string | null;
};

export function StoreMarquee({ stores }: { stores: StoreItem[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 });
  if (!stores.length) return null;
  const items = stores.length > 4 ? [...stores, ...stores] : stores;

  return (
    <div className="mx-auto mt-8 max-w-6xl rounded-[1.7rem] border bg-slate-950 p-3 text-white shadow-2xl shadow-slate-900/10">
      <div className="mb-3 flex items-center justify-between gap-3 px-2 text-xs font-black text-white/70">
        <span>متاجر إضافية تتحرك تلقائياً ويمكن سحبها باللمس</span>
        <span className="inline-flex items-center gap-2 text-amber-300"><Sparkles className="h-4 w-4" /> خارج قائمة المتاجر المميزة</span>
      </div>
      <div
        ref={scrollerRef}
        className="store-marquee-scroll overflow-x-auto rounded-2xl pb-1"
        onPointerDown={(event) => {
          const node = scrollerRef.current;
          if (!node) return;
          drag.current = { active: true, startX: event.clientX, scrollLeft: node.scrollLeft };
          node.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const node = scrollerRef.current;
          if (!node || !drag.current.active) return;
          node.scrollLeft = drag.current.scrollLeft - (event.clientX - drag.current.startX);
        }}
        onPointerUp={(event) => {
          scrollerRef.current?.releasePointerCapture?.(event.pointerId);
          drag.current.active = false;
        }}
        onPointerCancel={() => { drag.current.active = false; }}
      >
        <div className="store-marquee-track flex w-max gap-3 px-1">
          {items.map((store, index) => <StoreBadge key={`${store.id || store.slug}-${index}`} store={store} />)}
        </div>
      </div>
    </div>
  );
}

function StoreBadge({ store }: { store: StoreItem }) {
  return (
    <Link href={`/store/${store.slug}`} prefetch={false} className="group flex min-w-[260px] items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 text-right backdrop-blur transition hover:bg-white hover:text-slate-950">
      <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/10 text-sm font-black text-white group-hover:bg-slate-100 group-hover:text-slate-700">
        {store.logoUrl || store.coverImageUrl ? <img src={store.logoUrl || store.coverImageUrl || ""} alt={store.name} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : <Store className="h-6 w-6" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-end gap-2">
          <Badge className="bg-amber-400 text-slate-950">★ {formatNumber(store.ratingAverage || 0)}</Badge>
          <p className="truncate text-sm font-black">{store.name || getInitials(store.name)}</p>
        </div>
        <p className="mt-1 truncate text-xs text-white/55 group-hover:text-slate-500">{[store.cityName, store.governorateName].filter(Boolean).join("، ") || "متجر داخل المول"}</p>
      </div>
      <ArrowLeft className="h-4 w-4 shrink-0 text-amber-300 group-hover:text-blue-600" />
    </Link>
  );
}
