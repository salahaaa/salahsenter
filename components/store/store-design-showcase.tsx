import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductMediaFrame } from "@/components/product/product-media-frame";
import { formatCurrency } from "@/lib/utils";

type Design = Awaited<ReturnType<typeof import("@/lib/enterprise/store-ai-setup").getStoreDesignSettings>>;

type Category = { id: string; name: string; slug: string; imageUrl: string | null };
type Product = { id: string; name: string; slug: string; mainImageUrl: string | null; basePrice: string | null };

export function StoreDesignShowcase({ design, categories, products, storeSlug }: { design: Design; categories: Category[]; products: Product[]; storeSlug: string }) {
  if (!design) return null;
  const primary = design.theme.primaryColor;
  const accent = design.theme.accentColor;
  return (
    <section className="container py-6" id="ai-store-design">
      <div className="overflow-hidden rounded-[2rem] border bg-white shadow-card">
        <div className="p-6 text-white md:p-8" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-black"><Sparkles className="h-4 w-4" /> تصميم ذكي</div>
              <h2 className="text-3xl font-black md:text-4xl">{design.input.storeName}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">{design.input.description || `تصميم ${design.theme.mood} لنشاط ${design.input.activity}`}</p>
            </div>
            <Button asChild variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20"><Link href="#products">تصفح المنتجات <ArrowLeft className="h-4 w-4" /></Link></Button>
          </div>
        </div>
        {design.banners?.length ? <div className="grid gap-4 p-5 md:grid-cols-2">{design.banners.slice(0, 2).map((banner) => <img key={banner.title} src={banner.imageUrl} alt={banner.title} className="h-48 w-full rounded-3xl object-cover" loading="lazy" decoding="async" />)}</div> : null}
        {categories.length ? <div className="px-5 pb-5"><h3 className="mb-3 text-xl font-black text-slate-950">أقسام مختارة</h3><div className="flex flex-wrap gap-2">{categories.slice(0, 8).map((category) => <Link key={category.id} href={`/store/${storeSlug}?category=${category.slug}`} className="rounded-full border bg-slate-50 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">{category.name}</Link>)}</div></div> : null}
        {products.length ? <div className="border-t bg-slate-50 p-5" id="products"><h3 className="mb-4 text-xl font-black text-slate-950">منتجات مختارة</h3><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{products.slice(0, 4).map((product) => <Link key={product.id} href={`/store/${storeSlug}/products/${product.slug}`} className="overflow-hidden rounded-[1.35rem] border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-soft"><ProductMediaFrame src={product.mainImageUrl} alt={product.name} className="aspect-[4/5]" imageClassName="p-2" /><div className="p-3"><p className="line-clamp-2 min-h-10 text-sm font-black text-slate-950">{product.name}</p><p className="mt-2 font-black text-teal-700">{product.basePrice ? formatCurrency(product.basePrice) : "حسب المتغير"}</p></div></Link>)}</div></div> : null}
      </div>
    </section>
  );
}
