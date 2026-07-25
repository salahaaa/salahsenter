import Link from "next/link";
import { Star } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatNumber } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  slug: string;
  mainImageUrl: string | null;
  basePrice: string | null;
  ratingAverage: string | number;
  soldCount: number;
  storeName: string;
  storeSlug: string;
};

export function ProductsGrid({ products }: { products: Product[] }) {
  if (!products.length) {
    return <EmptyState title="لا توجد منتجات نشطة" description="ستظهر المنتجات بعد إضافتها وتفعيلها من لوحة التاجر." />;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      {products.map((product) => (
        <Link key={product.id} href={`/store/${product.storeSlug}/products/${product.slug}`} prefetch={false} className="overflow-hidden rounded-3xl border bg-white shadow-card transition hover:-translate-y-1 hover:shadow-soft">
          <div className="h-44 bg-slate-100">
            {product.mainImageUrl ? (
              <img src={product.mainImageUrl} alt={product.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-xs font-bold text-slate-400">صورة المنتج غير مرفوعة</div>
            )}
          </div>
          <div className="p-4">
            <p className="line-clamp-1 text-xs font-bold text-slate-500">{product.storeName}</p>
            <h3 className="mt-2 line-clamp-2 min-h-11 text-sm font-black leading-6 text-slate-950">{product.name}</h3>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-black text-primary">{product.basePrice ? formatCurrency(product.basePrice) : "حسب المتغير"}</span>
              <span className="flex items-center gap-1 text-xs font-bold text-amber-500">
                <Star className="h-3.5 w-3.5 fill-current" /> {formatNumber(product.ratingAverage)}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
