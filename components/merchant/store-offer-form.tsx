"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BadgePercent, CalendarClock, Eye, PackagePlus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";
import { formatNumber } from "@/lib/utils";

type Campaign = { id: string; name: string };
type Product = { id: string; name: string; productCode: string | null; barcode: string | null; basePrice: string | null; mainImageUrl: string | null; status?: string; productCommerceType?: string };
type Variant = { id: string; productId: string; title: string | null; sku: string; price: string; stockQuantity: number; reservedQuantity: number; isActive: boolean };
type OfferType = "single" | "bundle" | "discount" | "exclusive" | "clearance" | "seasonal";
type DiscountMode = "fixed" | "percent";

type SelectedLine = Product & {
  quantity: number;
  unitPrice: number;
  originalLineTotal: number;
  customOfferPrice?: number;
  computedUnitOfferPrice: number;
  computedLineOfferTotal: number;
  selectedVariantId: string;
  variantTitle: string;
  availableStock: number;
};

export function StoreOfferForm({ storeId, campaigns, products, variants }: { storeId: string; campaigns: Campaign[]; products: Product[]; variants: Variant[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [publicationTarget, setPublicationTarget] = useState<"storefront" | "homepage">("storefront");
  const [itemOfferPrices, setItemOfferPrices] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [offerType, setOfferType] = useState<OfferType>("single");
  const [discountMode, setDiscountMode] = useState<DiscountMode>("fixed");
  const [discountValue, setDiscountValue] = useState(0);
  const [assembled, setAssembled] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  function markDirty() {
    setAssembled(false);
  }

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 80);
    return products.filter((p) => [p.name, p.productCode, p.barcode].filter(Boolean).join(" ").toLowerCase().includes(q)).slice(0, 120);
  }, [products, query]);

  const selectedLines = useMemo<SelectedLine[]>(() => {
    const selectedProducts = products.filter((product) => selected.has(product.id));
    const totalQty = selectedProducts.reduce((sum, product) => sum + Math.max(1, Number(quantities[product.id] || 1)), 0);
    const bundleUnitPrice = discountMode === "fixed" && discountValue > 0 && totalQty > 0 ? discountValue / totalQty : null;
    return selectedProducts.map((product) => {
      const variant = variants.find((item) => item.id === selectedVariants[product.id]) || variants.find((item) => item.productId === product.id && item.isActive);
      const quantity = Math.max(1, Number(quantities[product.id] || 1));
      const unitPrice = Number(variant?.price || product.basePrice || 0);
      const customOfferPrice = Number(itemOfferPrices[product.id] || 0) || undefined;
      const computedUnitOfferPrice = customOfferPrice ?? (discountMode === "percent" && discountValue > 0 ? Math.max(0, unitPrice * (1 - discountValue / 100)) : bundleUnitPrice ?? unitPrice);
      return {
        ...product,
        selectedVariantId: variant?.id || "",
        variantTitle: variant?.title || "افتراضي",
        availableStock: Math.max(0, Number(variant?.stockQuantity || 0) - Number(variant?.reservedQuantity || 0)),
        quantity,
        unitPrice,
        originalLineTotal: unitPrice * quantity,
        customOfferPrice,
        computedUnitOfferPrice,
        computedLineOfferTotal: computedUnitOfferPrice * quantity
      };
    });
  }, [products, variants, selected, selectedVariants, quantities, itemOfferPrices, discountMode, discountValue]);

  const selectedCount = selectedLines.length;
  const totalQuantity = selectedLines.reduce((sum, line) => sum + line.quantity, 0);
  const originalTotal = selectedLines.reduce((sum, line) => sum + line.originalLineTotal, 0);
  const computedOfferTotal = selectedLines.reduce((sum, line) => sum + line.computedLineOfferTotal, 0);
  const saving = originalTotal > 0 && computedOfferTotal > 0 && computedOfferTotal < originalTotal ? Math.round(((originalTotal - computedOfferTotal) / originalTotal) * 100) : 0;

  function toggle(id: string) {
    markDirty();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        setQuantities((current) => ({ ...current, [id]: current[id] || 1 }));
        setSelectedVariants((current) => ({ ...current, [id]: current[id] || variants.find((variant) => variant.productId === id && variant.isActive)?.id || "" }));
      }
      return next;
    });
  }

  function setLineQuantity(productId: string, value: number) {
    markDirty();
    setQuantities((current) => ({ ...current, [productId]: Math.max(1, Math.floor(Number(value || 1))) }));
  }

  function setLineOfferPrice(productId: string, value: string) {
    markDirty();
    setItemOfferPrices((current) => ({ ...current, [productId]: value }));
  }

  function assembleOffer() {
    if (!selectedCount) return setMessage("اختر أصناف العرض أولاً.");
    if (selectedLines.some((line) => !line.selectedVariantId || line.availableStock < line.quantity)) return setMessage("اختر متغيراً مخزونياً صالحاً لكل صنف وتأكد أن كميته متاحة داخل الباقة.");
    if (offerType === "bundle" && selectedCount < 2 && totalQuantity < 2) return setMessage("العرض المجمع يجب أن يحتوي على أكثر من صنف أو أكثر من قطعة.");
    if (discountMode === "percent" && (discountValue <= 0 || discountValue > 100)) return setMessage("نسبة الخصم يجب أن تكون بين 1 و 100.");
    if (discountMode === "fixed" && discountValue <= 0 && !selectedLines.some((line) => line.customOfferPrice && line.customOfferPrice > 0)) return setMessage("حدد سعر الباقة أو سعر عرض لكل صنف قبل التجميع.");
    setAssembled(true);
    setShowPreview(true);
    setMessage("✓ تم تجميع العرض. راجع التفاصيل، ويمكنك تعديل الكميات أو الأسعار ثم اضغط تجميع مرة أخرى قبل الإرسال.");
  }

  async function suggestBundleWithAi() {
    if (!aiPrompt.trim()) return setMessage("اكتب فكرة العرض أولاً، مثل: عرض رمضان من الرز والزيت والسكر.");
    setAiLoading(true);
    setMessage(null);
    const response = await fetch("/api/merchant/offers/ai-suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: aiPrompt, targetDiscountPercent: discountMode === "percent" ? discountValue || undefined : undefined })
    });
    const json = await response.json().catch(() => ({}));
    setAiLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر توليد الاقتراح");
    const suggestion = json.data?.suggestion;
    if (!suggestion?.items?.length) return setMessage("لم أجد منتجات مناسبة للاقتراح داخل متجرك.");
    const nextSelected = new Set<string>();
    const nextVariants: Record<string, string> = {};
    const nextQuantities: Record<string, number> = {};
    const nextPrices: Record<string, string> = {};
    for (const item of suggestion.items as Array<{ productId: string; quantity: number; suggestedUnitOfferPrice?: number }>) {
      if (!products.some((product) => product.id === item.productId)) continue;
      nextSelected.add(item.productId);
      nextVariants[item.productId] = variants.find((variant) => variant.productId === item.productId && variant.isActive)?.id || "";
      nextQuantities[item.productId] = Math.max(1, Number(item.quantity || 1));
      if (item.suggestedUnitOfferPrice) nextPrices[item.productId] = String(item.suggestedUnitOfferPrice);
    }
    setTitle(suggestion.title || "عرض مجمع ذكي");
    setDescription([suggestion.description, ...(suggestion.warnings || [])].filter(Boolean).join("\n"));
    setOfferType("bundle");
    setDiscountMode("fixed");
    setDiscountValue(Number(suggestion.suggestedBundlePrice || 0));
    setSelected(nextSelected);
    setSelectedVariants(nextVariants);
    setQuantities(nextQuantities);
    setItemOfferPrices(nextPrices);
    setAssembled(false);
    setShowPreview(false);
    setMessage(`✓ تم اقتراح عرض ذكي. الكمية الممكنة حسب المخزون: ${formatNumber(Number(suggestion.maxBundleQuantity || 0))} باقة. اضغط «تجميع العرض» للمراجعة النهائية.`);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.size || loading) return;
    if (!assembled) return setMessage("اضغط زر «تجميع العرض» أولاً لمراجعة التفاصيل قبل الإرسال.");
    if (offerType === "bundle" && selectedCount < 2 && totalQuantity < 2) return setMessage("العرض المجمع يجب أن يحتوي على أكثر من صنف أو أكثر من قطعة.");
    const form = event.currentTarget;
    const data = new FormData(form);
    const bundlePrice = discountMode === "fixed" ? discountValue || undefined : undefined;
    const discountPercent = discountMode === "percent" ? discountValue || 0 : 0;
    const items = selectedLines.map((line) => ({ productId: line.id, variantId: line.selectedVariantId, quantity: line.quantity, offerPrice: line.customOfferPrice || undefined }));
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/merchant/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        campaignId: data.get("campaignId") || undefined,
        publicationTarget,
        title: data.get("title"),
        description: data.get("description") || undefined,
        imageUrl: selected.size === 1 ? "" : data.get("imageUrl") || "",
        bundlePrice,
        bundleQuantity: Number(data.get("bundleQuantity") || 0),
        discountPercent,
        offerType,
        startsAt: data.get("startsAt") ? new Date(String(data.get("startsAt"))).toISOString() : null,
        endsAt: data.get("endsAt") ? new Date(String(data.get("endsAt"))).toISOString() : null,
        promotionPackage: JSON.stringify({ assembledPreview: { originalTotal, computedOfferTotal, totalQuantity, saving } }),
        items
      })
    });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? `✓ ${json.data?.message || "تم إرسال العرض للمراجعة"}` : json.message || "تعذر إنشاء العرض");
    if (response.ok) {
      form.reset();
      setSelected(new Set());
      setSelectedVariants({});
      setQuantities({});
      setItemOfferPrices({});
      setQuery("");
      setAssembled(false);
      setShowPreview(false);
      setDiscountValue(0);
      setPublicationTarget("storefront");
      setTitle("");
      setDescription("");
      setAiPrompt("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="overflow-hidden rounded-[2rem] border bg-white shadow-card">
      <div className="bg-gradient-to-l from-slate-950 via-blue-950 to-indigo-900 p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black"><Sparkles className="h-4 w-4 text-amber-300" /> Merchant Smart Offers</div>
            <h2 className="text-2xl font-black md:text-3xl">إنشاء صنف عرض ذكي</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/70">اختر المنتجات، حدد كمية كل صنف داخل العرض، ثم اضغط تجميع العرض لمراجعة الباقة قبل إرسالها.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-white/10 p-4"><div className="text-3xl font-black">{formatNumber(selectedCount)}</div><div className="text-xs font-bold text-white/70">أصناف</div></div>
            <div className="rounded-2xl bg-white/10 p-4"><div className="text-3xl font-black">{formatNumber(totalQuantity)}</div><div className="text-xs font-bold text-white/70">قطع</div></div>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <section className="rounded-2xl border border-violet-200 bg-gradient-to-l from-violet-50 to-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-black text-violet-950">مساعد العروض الذكي</h3><p className="mt-1 text-xs font-bold text-violet-800">اكتب فكرة العرض، وسيقترح النظام الأصناف والكميات وسعر الباقة حسب المخزون المتاح.</p></div>
            <Sparkles className="h-6 w-6 text-violet-500" />
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Textarea value={aiPrompt} onChange={(e)=>setAiPrompt(e.target.value)} placeholder="مثال: اعمل لي عرض رمضان من 3 دبات زيت و2 كيس رز و3 صحون تقديم بسعر مناسب" />
            <Button type="button" disabled={aiLoading || loading} onClick={suggestBundleWithAi} className="h-full min-h-20 rounded-2xl">{aiLoading ? "يفكر..." : "اقتراح عرض"}</Button>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2"><Label>مناسبة العرض</Label><select name="campaignId" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">بدون مناسبة</option>{campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="space-y-2"><Label>عنوان العرض</Label><Input name="title" required value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="مثال: باقة التموين العائلية" /></div>
          <div className="space-y-2"><Label>نوع العرض</Label><select value={offerType} onChange={(e)=>{ setOfferType(e.target.value as OfferType); markDirty(); }} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="single">عرض منتج واحد</option><option value="bundle">عرض مجمع لعدة منتجات</option><option value="discount">تخفيض</option><option value="exclusive">حصري</option><option value="clearance">تصريف مخزون</option><option value="seasonal">موسمي</option></select></div>
          {selected.size !== 1 ? <MediaUrlInput label="صورة العرض" name="imageUrl" storeId={storeId} folder={`stores/${storeId}/offers`} accept="image/*" /> : <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">تم اختيار منتج واحد؛ سيتم استخدام صورة المنتج تلقائياً ولا حاجة لرفع صورة عرض.</div>}
          <Field label="بداية العرض" name="startsAt" type="datetime-local" required />
          <Field label="نهاية العرض" name="endsAt" type="datetime-local" required />
          <div className="space-y-2"><Label>طريقة الخصم</Label><select value={discountMode} onChange={(e)=>{ setDiscountMode(e.target.value as DiscountMode); markDirty(); }} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="fixed">سعر الباقة الإجمالي</option><option value="percent">نسبة الخصم %</option></select></div>
          <div className="space-y-2"><Label>{discountMode === "fixed" ? "سعر الباقة الإجمالي" : "نسبة الخصم"}</Label><Input value={discountValue || ""} onChange={(e)=>{ setDiscountValue(Number(e.target.value || 0)); markDirty(); }} name="discountValue" type="number" placeholder={discountMode === "fixed" ? "مثال: 15000" : "مثال: 20"} required /></div>
          <Field label="عدد وحدات العرض المخزنية" name="bundleQuantity" type="number" required placeholder="مثال: 50" />
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs font-bold leading-6 text-blue-900 md:col-span-3"><b>هذا العرض سيتحول إلى منتج مخزني مستقل:</b> يخصم النظام مكونات الباقة من مخزونها ويضيف عدد وحدات العرض الذي تحدده كمنتج جديد قابل للبيع. عند انتهاء العرض تستطيع تفكيك الوحدات غير المباعة وإعادة المكونات إلى المخزون.</div>
          <fieldset className="grid gap-3 rounded-2xl border bg-slate-50 p-4 md:col-span-3 md:grid-cols-2"><legend className="px-2 text-sm font-black text-slate-900">أين تريد نشر العرض؟</legend><label className={`cursor-pointer rounded-2xl border p-4 transition ${publicationTarget === "storefront" ? "border-emerald-500 bg-emerald-50" : "bg-white"}`}><input className="ml-2" type="radio" name="publicationTarget" value="storefront" checked={publicationTarget === "storefront"} onChange={() => setPublicationTarget("storefront")} /><b>نافذة عروض متجري</b><p className="mt-2 text-xs leading-6 text-slate-600">ينشر مباشرة داخل متجرك بعد التحقق من الأسعار والمخزون. لا يظهر في الرئيسية أو منصة العروض العامة.</p></label><label className={`cursor-pointer rounded-2xl border p-4 transition ${publicationTarget === "homepage" ? "border-amber-500 bg-amber-50" : "bg-white"}`}><input className="ml-2" type="radio" name="publicationTarget" value="homepage" checked={publicationTarget === "homepage"} onChange={() => setPublicationTarget("homepage")} /><b>الرئيسية ومنصة العروض</b><p className="mt-2 text-xs leading-6 text-slate-600">سيرسل العرض للمراجعة. لن يظهر للعامة قبل أن تعتمد الإدارة السعر والمكونات والصورة والفترة ومكان الظهور.</p></label></fieldset>
          <div className="space-y-2 md:col-span-3"><Label>وصف العرض</Label><Textarea name="description" value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="مثال: 3 دبات زيت + 2 كيس رز + 3 صحون تقديم بسعر باقة خاص" /></div>
        </div>

        <section className="rounded-2xl border bg-slate-50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-black">اختر أصناف وكميات العرض</h3><p className="mt-1 text-xs font-bold text-slate-500">يمكنك اختيار الصنف مرة واحدة ثم تحديد كمية القطع المطلوبة داخل العرض، مثل 3 دبات زيت و2 كيس رز.</p></div>
            <div className="flex gap-2 text-xs font-black"><span className="rounded-full bg-white px-3 py-2"><PackagePlus className="ml-1 inline h-4 w-4 text-blue-500" /> {formatNumber(selectedCount)} صنف</span><span className="rounded-full bg-white px-3 py-2"><BadgePercent className="ml-1 inline h-4 w-4 text-emerald-500" /> قبل العرض: {formatNumber(originalTotal)}</span></div>
          </div>
          <div className="mb-3 flex items-center gap-2 rounded-2xl border bg-white px-3"><Search className="h-4 w-4 text-blue-500"/><input value={query} onChange={(e)=>setQuery(e.target.value)} className="h-11 flex-1 bg-transparent text-sm outline-none" placeholder="بحث: رقم الصنف، اسم الصنف، الباركود..."/></div>
          <div className="max-h-[520px] overflow-auto rounded-2xl border bg-white"><table className="w-full min-w-[1100px] text-right text-sm"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-3">اختيار</th><th className="p-3">رقم الصنف</th><th className="p-3">اسم الصنف</th><th className="p-3">المتغير والمخزون</th><th className="p-3">السعر الأساسي</th><th className="p-3">الكمية داخل العرض</th><th className="p-3">سعر عرض للوحدة</th><th className="p-3">إجمالي السطر</th><th className="p-3">الحالة</th></tr></thead><tbody>{filteredProducts.map((p)=>{ const line = selectedLines.find((item)=>item.id===p.id); const isSelected = selected.has(p.id); const productVariants = variants.filter((variant)=>variant.productId===p.id && variant.isActive); return <tr key={p.id} className={`border-t ${isSelected?"bg-blue-50":"hover:bg-slate-50"}`}><td className="p-3"><input type="checkbox" checked={isSelected} onChange={()=>toggle(p.id)} disabled={!productVariants.length}/></td><td className="p-3 font-mono text-xs">{p.productCode || p.barcode || "-"}</td><td className="p-3 font-black">{p.name}</td><td className="p-3"><select value={selectedVariants[p.id] || productVariants[0]?.id || ""} disabled={!isSelected || !productVariants.length} onChange={(event)=>{markDirty();setSelectedVariants((current)=>({...current,[p.id]:event.target.value}))}} className="h-10 min-w-48 rounded-xl border bg-white px-2 text-xs">{!productVariants.length?<option value="">لا يوجد متغير نشط</option>:productVariants.map((variant)=><option key={variant.id} value={variant.id}>{variant.title || variant.sku} — {formatNumber(Math.max(0,Number(variant.stockQuantity)-Number(variant.reservedQuantity)))}</option>)}</select></td><td className="p-3">{line ? formatNumber(line.unitPrice) : p.basePrice || 0}</td><td className="p-3"><Input type="number" min={1} max={line?.availableStock || undefined} value={quantities[p.id] || 1} disabled={!isSelected} onChange={(e)=>setLineQuantity(p.id, Number(e.target.value || 1))} className="w-24" /></td><td className="p-3"><Input value={itemOfferPrices[p.id] || ""} onChange={(e)=>setLineOfferPrice(p.id, e.target.value)} name={`price-${p.id}`} type="number" disabled={!isSelected} placeholder="اختياري" className="w-32" /></td><td className="p-3 font-black text-primary">{line ? formatNumber(line.computedLineOfferTotal) : "-"}</td><td className="p-3 text-xs">{productVariants.length?"نشط":"بلا مخزون"}</td></tr>})}</tbody></table></div>
          <p className="mt-2 text-xs font-bold text-slate-500">يعرض الجدول أول 80 منتجاً افتراضياً، وعند البحث يعرض حتى 120 نتيجة مطابقة.</p>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-black text-amber-950">تجميع ومراجعة العرض قبل الإرسال</h3><p className="mt-1 text-xs font-bold text-amber-800">اضغط تجميع العرض لعرض كل التفاصيل: الأصناف، الكميات، السعر قبل العرض، السعر بعد العرض، ونسبة التوفير.</p></div>
            <Button type="button" variant="secondary" onClick={assembleOffer} disabled={!selectedCount || loading}><Eye className="h-4 w-4" /> تجميع العرض</Button>
          </div>
          {showPreview ? <OfferPreview lines={selectedLines} originalTotal={originalTotal} computedOfferTotal={computedOfferTotal} saving={saving} discountMode={discountMode} discountValue={discountValue} /> : null}
        </section>

        <div className="flex flex-wrap items-center gap-3"><Button disabled={!selected.size || !assembled || loading}>{loading ? "جارٍ الإنشاء..." : publicationTarget === "storefront" ? "إنشاء ونشر العرض داخل متجري" : "إرسال طلب نشر العرض للرئيسية"}</Button><span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"><CalendarClock className="h-4 w-4" /> {publicationTarget === "homepage" ? "سيظهر طلب مراجعة الإدارة بعد التجميع" : "ينشر داخل المتجر بعد التجميع والتحقق من المخزون"}</span>{message ? <span className="rounded-2xl bg-slate-50 px-4 py-2 text-sm font-bold text-slate-600">{message}</span> : null}</div>
      </div>
    </form>
  );
}

function OfferPreview({ lines, originalTotal, computedOfferTotal, saving, discountMode, discountValue }: { lines: SelectedLine[]; originalTotal: number; computedOfferTotal: number; saving: number; discountMode: DiscountMode; discountValue: number }) {
  return <div className="mt-4 rounded-2xl border bg-white p-4"><div className="mb-3 grid gap-3 md:grid-cols-4"><Summary label="عدد الأصناف" value={formatNumber(lines.length)} /><Summary label="إجمالي القطع" value={formatNumber(lines.reduce((sum,line)=>sum+line.quantity,0))} /><Summary label="قبل العرض" value={formatNumber(originalTotal)} /><Summary label="بعد العرض" value={formatNumber(computedOfferTotal)} /></div><div className="overflow-x-auto rounded-2xl border"><table className="w-full min-w-[820px] text-right text-sm"><thead className="bg-slate-100"><tr><th className="p-3">الصنف</th><th className="p-3">الكمية</th><th className="p-3">سعر الوحدة قبل</th><th className="p-3">الإجمالي قبل</th><th className="p-3">سعر الوحدة بعد</th><th className="p-3">الإجمالي بعد</th></tr></thead><tbody>{lines.map((line)=><tr key={line.id} className="border-t"><td className="p-3 font-black">{line.name}</td><td className="p-3">{line.quantity}</td><td className="p-3">{formatNumber(line.unitPrice)}</td><td className="p-3">{formatNumber(line.originalLineTotal)}</td><td className="p-3">{formatNumber(line.computedUnitOfferPrice)}</td><td className="p-3 font-black text-primary">{formatNumber(line.computedLineOfferTotal)}</td></tr>)}</tbody></table></div><div className="mt-3 rounded-xl bg-slate-950 p-3 text-sm font-bold text-white">{discountMode === "fixed" ? `سعر الباقة المدخل: ${formatNumber(discountValue)} — ` : `نسبة الخصم: ${formatNumber(discountValue)}% — `}التوفير التقريبي: {saving ? `${saving}%` : "لا يوجد توفير واضح؛ راجع السعر"}</div></div>;
}
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-950">{value}</p></div>; }
function Field({label,name,type="text",required=false,placeholder}:{label:string;name:string;type?:string;required?:boolean;placeholder?:string}){return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} required={required} placeholder={placeholder||""}/></div>}
