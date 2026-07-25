"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingCart, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";

type CartItem = {
  id: string;
  cartItemId?: string;
  productId: string;
  variantId: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  name: string;
  variantTitle?: string | null;
  href: string;
  imageUrl?: string | null;
  price?: string | number | null;
  quantity: number;
  stockQuantity?: number | null;
  available?: boolean;
};

const localCartKey = "salah_center_cart";

export function ServerCartManager() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function loadAndSync() {
    setLoading(true);
    setMessage(null);
    try {
      const localRows = JSON.parse(localStorage.getItem(localCartKey) || "[]");
      const localItems = Array.isArray(localRows)
        ? localRows.filter((item) => item.productId && item.variantId).map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: Math.max(1, Number(item.quantity || 1)) }))
        : [];
      const response = localItems.length
        ? await fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "replace", items: localItems }) })
        : await fetch("/api/cart", { cache: "no-store" });
      const json = await response.json();
      const serverItems = json.data?.items || [];
      setItems(serverItems);
      localStorage.setItem(localCartKey, JSON.stringify(serverItems));
    } catch {
      setMessage("تعذر تحميل السلة");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAndSync(); }, []);

  const groups = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    for (const item of items) map.set(item.storeId, [...(map.get(item.storeId) || []), item]);
    return [...map.entries()].map(([storeId, rows]) => ({ storeId, storeName: rows[0]?.storeName || "متجر", storeSlug: rows[0]?.storeSlug || "", items: rows }));
  }, [items]);

  const total = items.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);

  async function updateQuantity(item: CartItem, quantity: number) {
    const safe = Math.max(1, quantity);
    setItems((current) => current.map((row) => row.id === item.id ? { ...row, quantity: safe } : row));
    if (item.cartItemId) await fetch(`/api/cart/items/${item.cartItemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity: safe }) });
    await loadAndSync();
  }

  async function remove(item: CartItem) {
    if (item.cartItemId) await fetch(`/api/cart/items/${item.cartItemId}`, { method: "DELETE" });
    await loadAndSync();
  }

  async function clearCart() {
    if (!window.confirm("تفريغ السلة بالكامل؟")) return;
    await fetch("/api/cart", { method: "DELETE" });
    localStorage.removeItem(localCartKey);
    setItems([]);
  }

  if (loading) return <div className="rounded-3xl border bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-card">جارٍ تحميل السلة...</div>;
  if (!items.length) return <div className="rounded-3xl border bg-white p-8 text-center shadow-card"><ShoppingCart className="mx-auto mb-3 h-12 w-12 text-slate-300" /><h2 className="text-2xl font-black">السلة فارغة</h2><p className="mt-2 text-sm text-slate-500">أضف منتجات من المتاجر ثم عد لإتمام الشراء.</p><Button asChild className="mt-5"><Link href="/">العودة للتسوق</Link></Button></div>;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {groups.map((group) => <section key={group.storeId} className="overflow-hidden rounded-3xl border bg-white shadow-card"><div className="flex items-center justify-between bg-slate-950 p-5 text-white"><h2 className="flex items-center gap-2 text-xl font-black"><Store className="h-5 w-5" /> {group.storeName}</h2><Badge className="bg-white text-slate-950">{formatNumber(group.items.length)} منتج</Badge></div><div className="divide-y">{group.items.map((item) => <article key={item.id} className="flex gap-4 p-4"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-100">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : null}</div><div className="min-w-0 flex-1 text-right"><Link href={item.href} className="line-clamp-1 font-black text-slate-950 hover:text-primary">{item.name}</Link><p className="mt-1 text-xs text-slate-500">{item.variantTitle || "افتراضي"}</p><p className="mt-2 font-black text-primary">{formatNumber(Number(item.price || 0))}</p>{item.available === false ? <Badge variant="danger" className="mt-2">غير متاح حالياً</Badge> : null}</div><div className="flex flex-col items-end gap-2"><input type="number" min={1} max={item.stockQuantity || 999} value={item.quantity} onChange={(e) => void updateQuantity(item, Number(e.target.value || 1))} className="h-10 w-20 rounded-xl border text-center font-black" /><Button type="button" size="sm" variant="destructive" onClick={() => void remove(item)}><Trash2 className="h-4 w-4" /></Button></div></article>)}</div></section>)}
      </div>
      <aside className="h-fit rounded-3xl border bg-white p-6 shadow-card"><h2 className="text-xl font-black">ملخص السلة</h2><div className="mt-5 rounded-2xl bg-slate-50 p-4"><div className="flex justify-between text-sm font-bold text-slate-600"><span>عدد المنتجات</span><span>{formatNumber(items.reduce((sum, item) => sum + item.quantity, 0))}</span></div><div className="mt-3 flex justify-between text-lg font-black"><span>الإجمالي</span><span>{formatNumber(total)}</span></div></div><Button asChild className="mt-5 w-full rounded-2xl"><Link href="/checkout">إتمام الشراء</Link></Button><Button type="button" variant="outline" className="mt-2 w-full rounded-2xl" onClick={() => void clearCart()}>تفريغ السلة</Button>{message ? <p className="mt-3 text-sm font-bold text-red-600">{message}</p> : null}</aside>
    </div>
  );
}
