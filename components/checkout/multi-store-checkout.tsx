"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PackageCheck, ShieldCheck, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { trackFunnelEvent } from "@/lib/funnel-client";
import { clearPendingAdAttribution, readPendingAdAttribution } from "@/lib/ads/client-attribution";

type CartItem = { id: string; cartItemId?: string; productId: string; variantId: string; storeId: string; storeSlug: string; name: string; imageUrl?: string | null; price?: string | number | null; storeName: string; quantity: number; attributes?: Record<string,string> };
type Method = { id: string; storeId: string | null; name: string; code: string; fee?: string; provider?: string; description?: string | null };
type StoreOptions = { id: string; name: string; slug: string; currency: { code: string; symbol?: string; rateToBase: number }; paymentMethods: Method[]; shippingMethods: Method[]; orderSettings: { minOrderAmount?: number; shippingPolicy?: string; returnPolicy?: string; preparationMinutes?: number } };
type SavedAddress = { id: string; label: string; recipientName: string; phone: string; governorateId?: string | null; cityId?: string | null; districtId?: string | null; cityText?: string | null; districtText?: string | null; addressLine: string; landmark?: string | null; isDefault: boolean };
const cartKey = "salah_center_cart";
const checkoutAttemptsKey = "salah_center_checkout_attempts_v1";
type CheckoutAttempt = { signature: string; key: string };
function newKey(storeId: string) { return globalThis.crypto?.randomUUID?.() || `checkout_${storeId}_${Date.now()}_${Math.random().toString(36).slice(2)}`; }
function readCheckoutAttempts(): Record<string, CheckoutAttempt> { try { const value = JSON.parse(localStorage.getItem(checkoutAttemptsKey) || "{}"); return value && typeof value === "object" ? value : {}; } catch { return {}; } }
function writeCheckoutAttempts(value: Record<string, CheckoutAttempt>) { localStorage.setItem(checkoutAttemptsKey, JSON.stringify(value)); }

export function MultiStoreCheckout() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [options, setOptions] = useState<StoreOptions[]>([]);
  const [paymentByStore, setPaymentByStore] = useState<Record<string,string>>({});
  const [shippingByStore, setShippingByStore] = useState<Record<string,string>>({});
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [address, setAddress] = useState({ fullName: "", phone: "", city: "", district: "", addressLine: "", governorateId: "", cityId: "", districtId: "", landmark: "" });
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [couponByStore, setCouponByStore] = useState<Record<string,string>>({});
  const [couponDiscountByStore, setCouponDiscountByStore] = useState<Record<string,number>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadAndSyncCart() {
      try {
        const localRows = JSON.parse(localStorage.getItem(cartKey) || "[]");
        const localItems = Array.isArray(localRows) ? localRows.filter((item) => item.productId && item.variantId).map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: Math.max(1, Number(item.quantity || 1)) })) : [];
        const response = localItems.length
          ? await fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "replace", items: localItems }) })
          : await fetch("/api/cart", { cache: "no-store" });
        const json = await response.json();
        if (!active) return;
        const serverItems = json.data?.items || [];
        setCart(serverItems);
        localStorage.setItem(cartKey, JSON.stringify(serverItems));
      } catch {
        if (active) setCart([]);
      }
    }
    loadAndSyncCart();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/customer/addresses", { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        if (!active) return;
        const rows = (json.data?.addresses || []) as SavedAddress[];
        setSavedAddresses(rows);
        const initial = rows.find((row) => row.isDefault) || rows[0];
        if (initial) {
          setSelectedAddressId(initial.id);
          setAddress({ fullName: initial.recipientName, phone: initial.phone, city: initial.cityText || "", district: initial.districtText || "", addressLine: initial.addressLine, governorateId: initial.governorateId || "", cityId: initial.cityId || "", districtId: initial.districtId || "", landmark: initial.landmark || "" });
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    for (const item of cart) map.set(item.storeId, [...(map.get(item.storeId) || []), item]);
    return [...map.entries()].map(([storeId, items]) => ({ storeId, storeName: items[0]?.storeName || "متجر", storeSlug: items[0]?.storeSlug || "", items }));
  }, [cart]);

  const totalsByCurrency = useMemo(() => groups.reduce<Record<string, number>>((result, group) => {
    const option = options.find((store) => store.id === group.storeId);
    const currency = option?.currency || { code: "YER", rateToBase: 1 };
    const amount = (subtotal(group.items) - Number(couponDiscountByStore[group.storeId] || 0) + Number((option?.shippingMethods || []).find((method) => method.id === shippingByStore[group.storeId])?.fee || 0)) / Math.max(1, Number(currency.rateToBase || 1));
    result[currency.code] = (result[currency.code] || 0) + Math.max(0, amount);
    return result;
  }, {}), [groups, options, couponDiscountByStore, shippingByStore]);
  const storeIdsParam = useMemo(() => groups.map((group) => group.storeId).join(","), [groups]);
  const checkoutOptionsQuery = useMemo(() => {
    const params = new URLSearchParams({ storeIds: storeIdsParam, subtotals: groups.map((group) => `${group.storeId}:${subtotal(group.items)}`).join(",") });
    if (address.governorateId) params.set("governorateId", address.governorateId);
    if (address.cityId) params.set("cityId", address.cityId);
    if (address.districtId) params.set("districtId", address.districtId);
    return params.toString();
  }, [storeIdsParam, groups, address.governorateId, address.cityId, address.districtId]);

  useEffect(() => {
    if (!storeIdsParam) return;
    let active = true;
    fetch(`/api/checkout/options?${checkoutOptionsQuery}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        if (!active) return;
        const stores = json.data?.stores || [];
        setOptions(stores);
        setPaymentByStore(Object.fromEntries(stores.map((store: StoreOptions) => [store.id, store.paymentMethods[0]?.id || ""])));
        setShippingByStore(Object.fromEntries(stores.map((store: StoreOptions) => [store.id, store.shippingMethods[0]?.id || ""])));
      })
      .catch(() => setMessage("تعذر تحميل خيارات الدفع والشحن"));
    return () => { active = false; };
  }, [storeIdsParam, checkoutOptionsQuery]);

  function setQuantity(id: string, quantity: number) {
    const safeQuantity = Math.max(1, quantity);
    const next = cart.map((item) => item.id === id ? { ...item, quantity: safeQuantity } : item);
    const item = next.find((row) => row.id === id);
    setCart(next);
    localStorage.setItem(cartKey, JSON.stringify(next));
    if (item?.cartItemId) void fetch(`/api/cart/items/${item.cartItemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity: safeQuantity }) });
  }

  function remove(id: string) {
    const item = cart.find((row) => row.id === id);
    const next = cart.filter((row) => row.id !== id);
    setCart(next);
    localStorage.setItem(cartKey, JSON.stringify(next));
    if (item?.cartItemId) void fetch(`/api/cart/items/${item.cartItemId}`, { method: "DELETE" });
  }

  function storeOptions(storeId: string) { return options.find((store) => store.id === storeId); }
  function subtotal(items: CartItem[]) { return items.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0); }
  function shippingFee(storeId: string) { const opt = storeOptions(storeId); const method = opt?.shippingMethods.find((item) => item.id === shippingByStore[storeId]); return Number(method?.fee || 0); }
  function storeCurrency(storeId: string) { return storeOptions(storeId)?.currency || { code: "YER", symbol: "YER", rateToBase: 1 }; }
  function convertForStore(storeId: string, amount: number) { const currency = storeCurrency(storeId); return Number(amount || 0) / Math.max(1, Number(currency.rateToBase || 1)); }
  function storeTotalBase(storeId: string, items: CartItem[]) { return Math.max(0, subtotal(items) - Number(couponDiscountByStore[storeId] || 0)) + shippingFee(storeId); }
  function storeTotalLabel(storeId: string, items: CartItem[]) { const currency = storeCurrency(storeId); return formatCurrency(convertForStore(storeId, storeTotalBase(storeId, items)), currency.code); }
  async function validateCouponForStore(storeId: string, subtotalValue: number) { const code = couponByStore[storeId]?.trim(); if (!code) return; const response = await fetch("/api/coupons/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, code, subtotal: subtotalValue }) }); const json = await response.json().catch(()=>({})); if (response.ok && json.data?.valid) { setCouponDiscountByStore((current)=>({ ...current, [storeId]: Number(json.data.discountAmount || 0) })); setMessage(`✓ ${json.data.message} — خصم ${formatNumber(Number(json.data.discountAmount||0))}`); } else { setCouponDiscountByStore((current)=>({ ...current, [storeId]: 0 })); setMessage(json.data?.message || json.message || "الكوبون غير صالح"); } }

  function attemptSignature(group: { storeId: string; items: CartItem[] }) {
    return JSON.stringify({
      storeId: group.storeId,
      items: group.items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })).sort((left, right) => left.variantId.localeCompare(right.variantId)),
      paymentMethodId: paymentByStore[group.storeId] || null,
      shippingMethodId: shippingByStore[group.storeId] || null,
      couponCode: couponByStore[group.storeId] || null,
      address
    });
  }

  async function removeSuccessfulStoreFromCart(storeId: string) {
    // Read the latest persisted cart rather than the render closure: multiple
    // stores may succeed in one submit loop before React applies state updates.
    let current = cart;
    try {
      const stored = JSON.parse(localStorage.getItem(cartKey) || "[]");
      if (Array.isArray(stored)) current = stored;
    } catch { /* retain the in-memory cart */ }
    const completedItems = current.filter((item) => item.storeId === storeId);
    const next = current.filter((item) => item.storeId !== storeId);
    setCart(next);
    localStorage.setItem(cartKey, JSON.stringify(next));
    await Promise.all(completedItems.filter((item) => item.cartItemId).map((item) => fetch(`/api/cart/items/${item.cartItemId}`, { method: "DELETE" }).catch(() => undefined)));
  }

  async function submit() {
    if (!groups.length || loading) return;
    setLoading(true);
    setMessage(null);
    const createdOrders: string[] = [];
    const successfulStoreIds = new Set<string>();
    const adAttribution = readPendingAdAttribution();
    let adAttributionAccepted = false;
    try {
      if (!address.fullName.trim() || !address.phone.trim() || !address.city.trim() || !address.addressLine.trim()) throw new Error("أدخل بيانات توصيل كاملة أو اختر عنواناً محفوظاً");
      for (const group of groups) {
        const opt = storeOptions(group.storeId);
        const storeSubtotal = subtotal(group.items);
        if (!opt) throw new Error(`تعذر تحميل إعدادات متجر ${group.storeName}. حدّث الصفحة ثم أعد المحاولة.`);
        if (Number(opt.orderSettings?.minOrderAmount || 0) > storeSubtotal) throw new Error(`متجر ${group.storeName}: أقل مبلغ طلب هو ${opt.orderSettings?.minOrderAmount}`);
        if (!paymentByStore[group.storeId]) throw new Error(`اختر وسيلة دفع لمتجر ${group.storeName}`);
        if (!shippingByStore[group.storeId]) throw new Error(`اختر وسيلة شحن لمتجر ${group.storeName}`);
        const signature = attemptSignature(group);
        const attempts = readCheckoutAttempts();
        const existingAttempt = attempts[group.storeId];
        const idempotencyKey = existingAttempt?.signature === signature ? existingAttempt.key : newKey(group.storeId);
        attempts[group.storeId] = { signature, key: idempotencyKey };
        writeCheckoutAttempts(attempts);
        trackFunnelEvent({ eventType: "checkout_started", storeId: group.storeId, metadata: { source: "checkout", cartItems: group.items.length } });
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({
            storeId: group.storeId,
            paymentMethodId: paymentByStore[group.storeId],
            shippingMethodId: shippingByStore[group.storeId],
            couponCode: couponByStore[group.storeId] || null,
            items: group.items.map((item) => ({ productId: item.productId, variantId: item.variantId, quantity: item.quantity })),
            deliveryAddress: { ...address, savedAddressId: selectedAddressId || null },
            customerNote: notes[group.storeId] || "",
            adAttribution
          })
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok || !json.success) throw new Error(`${group.storeName}: ${json.message || "تعذر إنشاء الطلب"}`);
        if (json.data?.adAttributionAccepted) adAttributionAccepted = true;
        createdOrders.push(json.data.order.id);
        successfulStoreIds.add(group.storeId);
        delete attempts[group.storeId];
        writeCheckoutAttempts(attempts);
        await removeSuccessfulStoreFromCart(group.storeId);
      }
      if (adAttributionAccepted) clearPendingAdAttribution();
      setMessage(`✓ تم إنشاء ${createdOrders.length} طلب منفصل حسب المتجر`);
      router.push(`/checkout/result?orders=${encodeURIComponent(createdOrders.join(","))}`);
    } catch (error) {
      const text = error instanceof Error ? error.message : "تعذر إكمال الشراء";
      if (successfulStoreIds.size) {
        const remaining = cart.filter((item) => !successfulStoreIds.has(item.storeId));
        setCart(remaining);
        localStorage.setItem(cartKey, JSON.stringify(remaining));
      }
      if (text.includes("تسجيل الدخول")) router.push(`/login?next=${encodeURIComponent("/checkout")}`);
      else if (createdOrders.length) router.push(`/checkout/result?orders=${encodeURIComponent(createdOrders.join(","))}&failed=${encodeURIComponent(text)}`);
      else setMessage(text);
    } finally { setLoading(false); }
  }

  if (!cart.length) return <div className="rounded-3xl border bg-white p-8 text-center shadow-card"><h2 className="text-2xl font-black">السلة فارغة</h2><p className="mt-2 text-sm text-slate-500">أضف منتجات من المتاجر ثم عد لإتمام الشراء.</p><Button asChild className="mt-5"><Link href="/">العودة للتسوق</Link></Button></div>;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section className="rounded-3xl border bg-white p-6 shadow-card"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">بيانات التوصيل</h2><p className="mt-1 text-xs font-bold text-slate-500">اختر عنواناً محفوظاً لتظهر وسائل الشحن التي تغطي محافظتك.</p></div><Link href="/addresses" className="text-sm font-black text-primary underline">إدارة العناوين</Link></div>{savedAddresses.length ? <div className="mb-4 space-y-2"><label className="text-sm font-black">العنوان المحفوظ</label><select value={selectedAddressId} onChange={(event)=>{ const selected=savedAddresses.find((row)=>row.id===event.target.value); setSelectedAddressId(event.target.value); if(selected) setAddress({ fullName:selected.recipientName, phone:selected.phone, city:selected.cityText||"", district:selected.districtText||"", addressLine:selected.addressLine, governorateId:selected.governorateId||"", cityId:selected.cityId||"", districtId:selected.districtId||"", landmark:selected.landmark||"" }); }} className="h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="">اكتب عنواناً جديداً</option>{savedAddresses.map((item)=><option key={item.id} value={item.id}>{item.label} — {item.cityText || "محافظة غير محددة"}</option>)}</select></div> : <p className="mb-4 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-800">احفظ عنوانك أولاً لتظهر تغطية الشحن الدقيقة لكل متجر.</p>}<div className="grid gap-3 md:grid-cols-2"><Input value={address.fullName} onChange={(e)=>setAddress({...address, fullName:e.target.value})} placeholder="اسم المستلم"/><Input value={address.phone} onChange={(e)=>setAddress({...address, phone:e.target.value})} placeholder="الهاتف"/><Input value={address.city} onChange={(e)=>setAddress({...address, city:e.target.value})} placeholder="المدينة"/><Input value={address.district} onChange={(e)=>setAddress({...address, district:e.target.value})} placeholder="المنطقة"/><Input className="md:col-span-2" value={address.addressLine} onChange={(e)=>setAddress({...address, addressLine:e.target.value})} placeholder="العنوان التفصيلي"/></div></section>
        {groups.map((group) => { const opt = storeOptions(group.storeId); return <section key={group.storeId} className="overflow-hidden rounded-3xl border bg-white shadow-card"><div className="flex items-center justify-between border-b bg-slate-950 p-5 text-white"><div><h2 className="flex items-center gap-2 text-xl font-black"><Store className="h-5 w-5"/> {group.storeName}</h2><p className="mt-1 text-xs text-white/60">سيتم إنشاء طلب مستقل لهذا المتجر فقط</p></div><Badge className="bg-white text-slate-950">{group.items.length} منتج</Badge></div><div className="space-y-3 p-5">{group.items.map((item)=><div key={item.id} className="flex gap-3 rounded-2xl bg-slate-50 p-3"><div className="h-16 w-16 overflow-hidden rounded-xl bg-white">{item.imageUrl?<img src={item.imageUrl} alt="" className="h-full w-full object-cover"/>:null}</div><div className="min-w-0 flex-1 text-right"><h3 className="line-clamp-1 font-black">{item.name}</h3><p className="text-xs text-slate-500">{formatCurrency(convertForStore(group.storeId, Number(item.price||0)), storeCurrency(group.storeId).code)}</p></div><input type="number" min={1} value={item.quantity} onChange={(e)=>setQuantity(item.id, Number(e.target.value||1))} className="h-10 w-20 rounded-xl border bg-white text-center font-black"/><Button type="button" size="sm" variant="destructive" onClick={()=>remove(item.id)}>حذف</Button></div>)}</div><div className="grid gap-4 border-t p-5 md:grid-cols-2"><div><label className="mb-2 block text-sm font-black">الدفع</label><select value={paymentByStore[group.storeId]||""} onChange={(e)=>setPaymentByStore({...paymentByStore,[group.storeId]:e.target.value})} className="h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="">اختر وسيلة الدفع</option>{opt?.paymentMethods.map((method)=><option key={method.id} value={method.id}>{method.name}</option>)}</select></div><div><label className="mb-2 block text-sm font-black">الشحن</label><select value={shippingByStore[group.storeId]||""} onChange={(e)=>setShippingByStore({...shippingByStore,[group.storeId]:e.target.value})} className="h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="">اختر وسيلة الشحن</option>{opt?.shippingMethods.map((method)=><option key={method.id} value={method.id}>{method.name} — {formatCurrency(convertForStore(group.storeId, Number(method.fee||0)), storeCurrency(group.storeId).code)}</option>)}</select></div><div className="flex gap-2 md:col-span-2"><input className="h-11 flex-1 rounded-xl border px-3 text-sm" placeholder="كود خصم لهذا المتجر" value={couponByStore[group.storeId]||""} onChange={(e)=>setCouponByStore({...couponByStore,[group.storeId]:e.target.value})}/><Button type="button" variant="outline" onClick={()=>void validateCouponForStore(group.storeId, subtotal(group.items))}>تطبيق</Button></div>{couponDiscountByStore[group.storeId] ? <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 md:col-span-2">خصم الكوبون: {formatCurrency(convertForStore(group.storeId, couponDiscountByStore[group.storeId]), storeCurrency(group.storeId).code)}</div> : null}<input className="h-11 rounded-xl border px-3 text-sm md:col-span-2" placeholder="ملاحظة لهذا المتجر" value={notes[group.storeId]||""} onChange={(e)=>setNotes({...notes,[group.storeId]:e.target.value})}/></div></section>; })}
      </div>
      <aside className="h-fit rounded-3xl border bg-white p-6 shadow-card"><h2 className="flex items-center gap-2 text-xl font-black"><PackageCheck className="h-5 w-5 text-blue-600"/> ملخص الشراء</h2><div className="mt-5 space-y-3">{groups.map((group)=><div key={group.storeId} className="rounded-2xl bg-slate-50 p-3 text-sm"><div className="flex justify-between font-black"><span>{group.storeName}</span><span>{storeTotalLabel(group.storeId, group.items)}</span></div><div className="mt-1 flex justify-between text-slate-500"><span>الشحن</span><span>{formatCurrency(convertForStore(group.storeId, shippingFee(group.storeId)), storeCurrency(group.storeId).code)}</span></div></div>)}</div><div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white"><p className="text-xs font-bold text-white/65">إجمالي كل متجر حسب عملته</p><div className="mt-2 space-y-1">{Object.entries(totalsByCurrency).map(([currency, amount]) => <div key={currency} className="flex justify-between"><span>{currency}</span><b>{formatCurrency(amount, currency)}</b></div>)}</div></div><div className="mt-4 rounded-2xl bg-blue-50 p-3 text-xs font-bold leading-6 text-blue-900"><ShieldCheck className="ml-1 inline h-4 w-4"/> عند وجود أكثر من متجر، سيتم فصل الشراء إلى طلب مستقل لكل متجر لضمان محاسبة وشحن ومتابعة منفصلة.</div><Button className="mt-5 w-full rounded-2xl" disabled={loading} onClick={submit}>{loading?"جارٍ إنشاء الطلبات...":"تأكيد الشراء"}</Button>{message?<p className="mt-3 rounded-2xl border bg-slate-50 p-3 text-sm font-bold text-slate-700">{message}</p>:null}</aside>
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={`h-11 rounded-xl border bg-white px-3 text-sm outline-none focus:ring-4 focus:ring-blue-100 ${props.className||""}`} />; }
