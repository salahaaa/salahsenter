import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber, getInitials } from "@/lib/utils";

type StoreCardData = {
  id: string;
  name: string;
  slug: string;
  coverImageUrl: string | null;
  logoUrl: string | null;
  ratingAverage: string | number;
  orderCount: number;
  countryName: string | null;
  governorateName: string | null;
  cityName: string | null;
};

export function StoresGrid({ stores, emptyTitle }: { stores: StoreCardData[]; emptyTitle: string }) {
  if (!stores.length) {
    return <EmptyState title={emptyTitle} description="بعد اعتماد المتاجر وإضافة وسائطها ستظهر هنا تلقائياً." />;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {stores.map((store) => (
        <StoreCard key={store.id} store={store} />
      ))}
    </div>
  );
}

export function StoreCard({ store }: { store: StoreCardData }) {
  return (
    <article className="overflow-hidden rounded-3xl border bg-white shadow-card transition hover:-translate-y-1 hover:shadow-soft">
      <div className="relative h-36 bg-slate-100">
        {store.coverImageUrl ? (
          <img src={store.coverImageUrl} alt={store.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs font-bold text-slate-400">
            لم يتم رفع صورة غلاف للمتجر
          </div>
        )}
        <div className="absolute -bottom-8 right-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-card">
          {store.logoUrl ? (
            <img src={store.logoUrl} alt={`شعار ${store.name}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg font-black text-primary">{getInitials(store.name)}</span>
          )}
        </div>
      </div>
      <div className="p-5 pt-11">
        <h3 className="line-clamp-1 text-lg font-black text-slate-950">{store.name}</h3>
        <div className="mt-2 flex items-center gap-1 text-xs font-bold text-slate-500">
          <MapPin className="h-4 w-4" />
          {[store.countryName, store.governorateName, store.cityName].filter(Boolean).join("، ") || "الموقع غير محدد"}
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="flex items-center gap-1 font-black text-amber-500">
            <Star className="h-4 w-4 fill-current" /> {formatNumber(store.ratingAverage)}
          </span>
          <span className="font-bold text-slate-500">{formatNumber(store.orderCount)} طلب</span>
        </div>
        <Button asChild className="mt-5 w-full">
          <Link href={`/store/${store.slug}`} prefetch={false}>زيارة المتجر</Link>
        </Button>
      </div>
    </article>
  );
}
