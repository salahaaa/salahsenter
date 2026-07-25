"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

type OfferProduct = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  variantId: string;
  variantTitle?: string | null;
  price: string | number;
  stockQuantity: number;
  reservedQuantity: number;
};

function available(product: OfferProduct) {
  return Math.max(0, Number(product.stockQuantity || 0) - Number(product.reservedQuantity || 0));
}

/**
 * A bundle is purchased as its generated native inventory product, never as a
 * client-side list of components. The regular cart and order services then
 * price and reserve the exact offer variant on the server.
 */
export function OfferCheckoutPanel({ storeId, storeSlug, storeName, offerProduct }: { storeId: string; storeSlug: string; storeName: string; offerProduct: OfferProduct | null }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const stock = offerProduct ? available(offerProduct) : 0;

  async function buyOffer() {
    if (!offerProduct || !stock || loading) return;
    setLoading(true);
    const current = JSON.parse(localStorage.getItem("salah_center_cart") || "[]") as any[];
    const now = new Date().toISOString();
    const item = {
      id: `${offerProduct.id}:${offerProduct.variantId}`,
      productId: offerProduct.id,
      variantId: offerProduct.variantId,
      storeId,
      storeSlug,
      name: offerProduct.name,
      href: `/store/${storeSlug}/products/${offerProduct.slug}`,
      imageUrl: offerProduct.imageUrl || null,
      price: offerProduct.price,
      storeName,
      quantity: Math.max(1, Math.min(stock, quantity)),
      addedAt: now,
      offerInventoryProduct: true
    };
    const index = current.findIndex((row) => row.id === item.id);
    if (index >= 0) current[index] = { ...current[index], quantity: Math.min(stock, Number(current[index].quantity || 0) + item.quantity), addedAt: now };
    else current.unshift(item);
    localStorage.setItem("salah_center_cart", JSON.stringify(current));
    router.push("/checkout");
  }

  return (
    <aside className="rounded-[2rem] border bg-white p-5 shadow-card">
      <h2 className="text-xl font-black text-slate-950">شراء المنتج المخزني للعرض</h2>
      {!offerProduct ? <p className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-800">هذا عرض قديم لا يملك منتجاً مخزنياً مولداً بعد، لذلك لا يتوفر الشراء المباشر منه.</p> : <>
        <div className="mt-4 flex gap-3 rounded-2xl bg-slate-50 p-3"><div className="h-16 w-16 overflow-hidden rounded-xl bg-white">{offerProduct.imageUrl ? <img src={offerProduct.imageUrl} alt="" className="h-full w-full object-cover" /> : null}</div><div className="min-w-0 flex-1 text-right"><p className="line-clamp-2 font-black">{offerProduct.name}</p><p className="mt-1 text-xs font-bold text-slate-500">{formatNumber(Number(offerProduct.price || 0))} لكل وحدة عرض</p><p className="mt-1 text-xs font-bold text-blue-600">المتاح: {formatNumber(stock)} وحدة</p></div></div>
        <div className="mt-4 flex items-center justify-between gap-3"><label className="text-sm font-bold text-slate-600">عدد وحدات العرض</label><input type="number" min={1} max={stock || 1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(stock || 1, Number(event.target.value || 1))))} className="h-10 w-24 rounded-xl border bg-white px-2 text-center font-black" disabled={!stock} /></div>
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-950 p-4 text-white"><span className="font-bold">الإجمالي</span><span className="text-2xl font-black">{formatNumber(Number(offerProduct.price || 0) * Math.max(1, Math.min(stock || 1, quantity)))}</span></div>
        <Button className="mt-4 w-full rounded-2xl" disabled={!stock || loading} onClick={buyOffer}>{loading ? "جارٍ الإضافة..." : stock ? "إضافة العرض إلى السلة" : "نفدت وحدات العرض"}</Button>
      </>}
    </aside>
  );
}
