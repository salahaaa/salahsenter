"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CurrencyPrice } from "@/components/currency/currency-price";
import { defaultCurrencySettings } from "@/lib/currency-shared";
import { clearComparisonProducts, readComparisonProducts, removeComparisonProduct } from "@/lib/discovery/product-comparison-client";

type Product = { id: string; name: string; storeName: string; storeSlug: string; imageUrl: string | null; minPrice: string | null; maxPrice: string | null; ratingAverage: string | number; ratingCount: number; inStock: boolean; href: string };
type Comparison = { products: Product[]; rows: Array<{ key: string; label: string; values: Record<string, string> }>; note: string };

function normalizeIds(value: string[]) {
  return [...new Set(value.filter(Boolean))].slice(0, 4);
}

export function ProductComparisonWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = useMemo(() => (searchParams.get("products") || "").split(",").filter(Boolean), [searchParams]);
  const [ids, setIds] = useState<string[]>([]);
  const [data, setData] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const next = normalizeIds(requested.length ? requested : readComparisonProducts());
    setIds(next);
  }, [requested]);

  useEffect(() => {
    if (ids.length < 2) { setData(null); return; }
    let active = true;
    setLoading(true);
    fetch(`/api/products/compare?ids=${encodeURIComponent(ids.join(","))}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => { if (active) setData(json.success ? json.data : null); })
      .catch(() => { if (active) setData(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ids]);

  function updateUrl(next: string[]) {
    const normalized = normalizeIds(next);
    setIds(normalized);
    const params = new URLSearchParams();
    if (normalized.length) params.set("products", normalized.join(","));
    router.replace(`/compare${params.size ? `?${params.toString()}` : ""}`);
  }

  function remove(id: string) {
    removeComparisonProduct(id);
    updateUrl(ids.filter((current) => current !== id));
  }

  function clear() {
    clearComparisonProducts();
    updateUrl([]);
  }

  if (ids.length < 2) return <section className="rounded-[2rem] border bg-white p-8 text-center shadow-card"><h2 className="text-2xl font-black text-slate-950">اختر منتجين على الأقل</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">من قسم «محلات تبيع نفس الصنف» أو «أصناف مشابهة» في صفحة أي منتج، اضغط زر «قارن» لإضافة البديل ومشاهدة جدول المواصفات هنا.</p><Button asChild className="mt-5"><Link href="/">استكشف المنتجات</Link></Button></section>;
  if (loading) return <section className="rounded-[2rem] border bg-white p-8 shadow-card"><div className="flex items-center justify-center gap-2 text-sm font-black text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> جارٍ تجهيز المقارنة...</div></section>;
  if (!data?.products.length) return <section className="rounded-[2rem] border bg-white p-8 text-center shadow-card"><h2 className="text-2xl font-black">لا تتوفر المقارنة الآن</h2><p className="mt-2 text-sm text-slate-500">ربما أصبح أحد المنتجات غير منشور أو غير متاح. اختر بدائل أخرى من صفحة المنتج.</p></section>;

  return <div className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-blue-50 p-4"><p className="text-sm font-bold text-blue-900">{data.note}</p><Button type="button" size="sm" variant="outline" onClick={clear}><Trash2 className="h-4 w-4" /> مسح المقارنة</Button></div><section className="overflow-hidden rounded-[2rem] border bg-white shadow-card"><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-right"><thead><tr className="border-b bg-slate-50"><th className="w-48 p-5 text-sm font-black text-slate-500">المعيار</th>{data.products.map((product) => <th key={product.id} className="min-w-60 p-5 align-top"><div className="flex items-start gap-3"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : null}</div><div className="min-w-0 flex-1"><Link href={product.href} className="line-clamp-2 font-black text-slate-950 hover:text-primary">{product.name}</Link><Link href={`/store/${product.storeSlug}`} className="mt-1 block text-xs font-bold text-slate-500 hover:text-primary">{product.storeName}</Link><div className="mt-2 flex flex-wrap items-center gap-2">{product.minPrice ? <CurrencyPrice amount={product.minPrice} settings={defaultCurrencySettings} className="text-sm font-black text-primary" /> : null}<Badge variant={product.inStock ? "success" : "warning"}>{product.inStock ? "متوفر" : "تحقق من التوفر"}</Badge></div></div><Button type="button" size="icon" variant="ghost" aria-label="إزالة من المقارنة" onClick={() => remove(product.id)}><Trash2 className="h-4 w-4" /></Button></div></th>)}</tr></thead><tbody>{data.rows.map((row) => <tr key={row.key} className="border-b last:border-0"><th className="bg-slate-50/60 p-4 text-sm font-black text-slate-700">{row.label}</th>{data.products.map((product) => <td key={product.id} className="p-4 text-sm font-bold text-slate-600">{row.key === "price" && product.minPrice ? <CurrencyPrice amount={product.minPrice} settings={defaultCurrencySettings} /> : row.values[product.id] || "—"}</td>)}</tr>)}</tbody></table></div></section></div>;
}
