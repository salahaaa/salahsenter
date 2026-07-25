"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function key() { return globalThis.crypto?.randomUUID?.() || `dissolve_${Date.now()}_${Math.random().toString(36).slice(2)}`; }

export function StoreOfferActions({ offerId, publicationTarget, publicationState, bundleRemainingQuantity = 0, endsAt }: { offerId: string; publicationTarget?: string | null; publicationState?: string | null; bundleRemainingQuantity?: number; endsAt?: Date | string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showDissolve, setShowDissolve] = useState(false);
  const [quantity, setQuantity] = useState<number>(bundleRemainingQuantity || 0);

  async function action(actionName: "pause" | "resume_storefront" | "request_homepage_review") {
    setLoading(actionName);
    setMessage(null);
    const response = await fetch(`/api/merchant/offers/${offerId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actionName }) });
    const json = await response.json().catch(() => ({}));
    setLoading(null);
    setMessage(response.ok ? `✓ ${json.data?.message || "تم تحديث العرض"}` : json.message || "تعذر تحديث العرض");
    if (response.ok) router.refresh();
  }

  async function dissolve(mode: "full" | "partial") {
    if (!bundleRemainingQuantity) return setMessage("لا توجد وحدات عرض متبقية قابلة للتفكيك");
    const q = mode === "full" ? bundleRemainingQuantity : Math.max(1, Math.min(bundleRemainingQuantity, Number(quantity || 1)));
    if (!window.confirm(`سيتم تفكيك ${q} وحدة عرض وإعادة مكوناتها إلى المخزون الأصلي. هل تريد المتابعة؟`)) return;
    setLoading("dissolve");
    setMessage(null);
    const response = await fetch(`/api/merchant/offers/${offerId}/dissolve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, quantity: q, idempotencyKey: key(), note: "Merchant dismantled offer inventory" }) });
    const json = await response.json().catch(() => ({}));
    setLoading(null);
    setMessage(response.ok ? json.data?.message || "✓ تم تفكيك العرض" : json.message || "تعذر تفكيك العرض");
    if (response.ok) router.refresh();
  }

  async function archive() {
    if (!window.confirm("سيتم تفكيك الوحدات المتاحة وأرشفة منتج العرض. لا يؤثر ذلك على الطلبات السابقة. هل تريد المتابعة؟")) return;
    setLoading("archive");
    const response = await fetch(`/api/merchant/offers/${offerId}`, { method: "DELETE" });
    const json = await response.json().catch(() => ({}));
    setLoading(null);
    setMessage(response.ok ? `✓ ${json.data?.message || "تمت أرشفة العرض"}` : json.message || "تعذر أرشفة العرض");
    if (response.ok) router.refresh();
  }

  const ended = endsAt ? new Date(endsAt).getTime() <= Date.now() : false;
  return <div className="space-y-2"><div className="flex flex-wrap items-center gap-2">
    {publicationState === "storefront_live" ? <Button type="button" size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => action("pause")}>إيقاف العرض</Button> : null}
    {publicationTarget === "storefront" && publicationState === "paused" && !ended ? <Button type="button" size="sm" disabled={Boolean(loading)} onClick={() => action("resume_storefront")}>إعادة نشره داخل المتجر</Button> : null}
    {publicationTarget !== "homepage" && ["storefront_live", "paused"].includes(publicationState || "") ? <Button type="button" size="sm" variant="secondary" disabled={Boolean(loading)} onClick={() => action("request_homepage_review")}>طلب نشر في الرئيسية</Button> : null}
    {publicationState === "homepage_review" ? <span className="rounded-xl bg-amber-50 px-2 py-1 text-xs font-black text-amber-800">بانتظار مراجعة الإدارة</span> : null}
    {publicationState === "homepage_approved" ? <Button type="button" size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => action("pause")}>إيقاف النشر</Button> : null}
    {bundleRemainingQuantity > 0 ? <Button type="button" size="sm" variant="secondary" disabled={Boolean(loading)} onClick={() => setShowDissolve((v) => !v)}>{ended ? "تفكيك مخزون العرض المنتهي" : "تفكيك وحدات العرض"}</Button> : null}
    <Button type="button" size="sm" variant="destructive" disabled={Boolean(loading)} onClick={archive}>أرشفة</Button>
  </div>
  {showDissolve ? <div className="grid gap-2 rounded-2xl border bg-amber-50 p-3 text-xs font-bold text-amber-900"><p>الوحدات المتبقية القابلة للتفكيك: {bundleRemainingQuantity}</p><p className="leading-6">إذا أردت إضافة صنف رابع أو تغيير السعر، فكك الوحدات غير المباعة أولاً ثم أنشئ عرضاً جديداً بالتركيبة الجديدة. الوحدات المباعة تبقى محفوظة في الطلبات السابقة.</p><div className="flex flex-wrap gap-2"><Input type="number" min={1} max={bundleRemainingQuantity} value={quantity || 1} onChange={(e)=>setQuantity(Number(e.target.value||1))} className="h-9 w-28"/><Button type="button" size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => dissolve("partial")}>تفكيك كمية</Button><Button type="button" size="sm" disabled={Boolean(loading)} onClick={() => dissolve("full")}>تفكيك الكل</Button></div></div> : null}
  {message ? <span className="text-xs font-bold text-slate-500">{message}</span> : null}</div>;
}
