"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";
import { MediaGalleryInput } from "@/components/media/media-gallery-input";

type Category = { id: string; name: string; code: string | null; level: number };
type Unit = { id: string; name: string; symbol: string | null };
type Attribute = { id: string; name: string; code: string; displayType: string; isRequired?: boolean };
type Value = { id: string; attributeId: string; value: string; code: string | null; colorHex: string | null };
type AttributeSelection = { key: string; attributeId: string; valueIds: string[] };
type VariantDraft = { key: string; title: string; sku: string; unitId: string; attributeValueIds: string[]; attributes: Record<string,string>; price: number; priceAdjustment: number; stockQuantity: number; lowStockThreshold: number; imageUrl: string; barcode: string };

function newSelectionRow(attributeId = ""): AttributeSelection {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, attributeId, valueIds: [] };
}

function normalizeText(value: string | null | undefined) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function unitLabel(unit: Unit) {
  return unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name;
}

export function ProductEngineForm({ storeId, storeSlug, categories, units, attributes, values }: { storeId: string; storeSlug?: string; categories: Category[]; units: Unit[]; attributes: Attribute[]; values: Value[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [selectionRows, setSelectionRows] = useState<AttributeSelection[]>([newSelectionRow()]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [previewLink, setPreviewLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [workspaceStep, setWorkspaceStep] = useState<"basics" | "media" | "variants" | "review">("basics");

  const valuesByAttribute = useMemo(() => {
    const map = new Map<string, Value[]>();
    for (const value of values) map.set(value.attributeId, [...(map.get(value.attributeId) || []), value]);
    return map;
  }, [values]);

  const valueById = useMemo(() => new Map(values.map((value) => [value.id, value])), [values]);
  const attributeById = useMemo(() => new Map(attributes.map((attribute) => [attribute.id, attribute])), [attributes]);
  const unitByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const unit of units) {
      map.set(normalizeText(unit.name), unit.id);
      if (unit.symbol) map.set(normalizeText(unit.symbol), unit.id);
      if (unit.symbol) map.set(normalizeText(`${unit.name} ${unit.symbol}`), unit.id);
    }
    return map;
  }, [units]);


  function setFormValue(name: string, value: unknown) {
    const element = formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (!element) return;
    element.value = value == null ? "" : String(value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function applyProductAiSuggestion() {
    if (!aiPrompt.trim()) return setMessage("اكتب وصفاً مختصراً للمنتج أولاً، مثل: قميص رجالي قطني أزرق مقاسات M L XL بسعر 12000 ومخزون 20.");
    setAiLoading(true);
    setMessage(null);
    const response = await fetch("/api/merchant/products/ai-assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: aiPrompt }) });
    const json = await response.json().catch(() => ({}));
    setAiLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر توليد اقتراح المنتج");
    const suggestion = json.data?.suggestion || {};
    setFormValue("name", suggestion.name);
    setFormValue("categoryId", suggestion.categoryId || "");
    setFormValue("brand", suggestion.brand || "");
    setFormValue("basePrice", suggestion.basePrice || "");
    setFormValue("defaultStock", suggestion.stockQuantity || "");
    setFormValue("shortDescription", suggestion.shortDescription || "");
    setFormValue("description", suggestion.description || "");
    const specs = suggestion.specifications ? Object.entries(suggestion.specifications as Record<string, unknown>).map(([key, value]) => `${key} = ${String(value)}`).join("\n") : "";
    if (specs) setFormValue("specifications", specs);
    if (Array.isArray(suggestion.attributeSelections) && suggestion.attributeSelections.length) {
      setSelectionRows(suggestion.attributeSelections.map((item: any) => ({ key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, attributeId: item.attributeId, valueIds: item.valueIds || [] })));
      setVariants([]);
    }
    setMessage(`✓ تم توليد بيانات المنتج. راجع الوصف والمتغيرات ثم اضغط توليد التركيبات إذا ظهرت مقاسات/ألوان. ثقة الاقتراح: ${suggestion.confidenceScore || 0}%`);
  }

  function resetGeneratedVariants() {
    if (variants.length) setVariants([]);
  }

  function addSelectionRow() {
    setSelectionRows((prev) => [...prev, newSelectionRow()]);
  }

  function removeSelectionRow(key: string) {
    setSelectionRows((prev) => {
      const next = prev.filter((row) => row.key !== key);
      return next.length ? next : [newSelectionRow()];
    });
    resetGeneratedVariants();
  }

  function changeSelectionAttribute(key: string, attributeId: string) {
    setSelectionRows((prev) => prev.map((row) => row.key === key ? { ...row, attributeId, valueIds: [] } : row));
    resetGeneratedVariants();
  }

  function toggleSelectionValue(key: string, valueId: string) {
    setSelectionRows((prev) => prev.map((row) => {
      if (row.key !== key) return row;
      const current = new Set(row.valueIds);
      current.has(valueId) ? current.delete(valueId) : current.add(valueId);
      return { ...row, valueIds: [...current] };
    }));
    resetGeneratedVariants();
  }

  function inferUnitId(attributesMap: Record<string, string>, fallbackUnitId: string) {
    for (const value of Object.values(attributesMap)) {
      const directMatch = unitByName.get(normalizeText(value));
      if (directMatch) return directMatch;
    }
    return fallbackUnitId;
  }

  function generateVariants(formData?: FormData) {
    const selectedGroups = selectionRows
      .filter((row) => row.attributeId && row.valueIds.length > 0)
      .map((row) => ({
        attributeId: row.attributeId,
        values: row.valueIds.map((id) => valueById.get(id)).filter(Boolean) as Value[]
      }))
      .filter((group) => group.values.length > 0);

    if (!selectedGroups.length) {
      setMessage("اختر متغيراً من القائمة ثم اختر قيمة واحدة على الأقل قبل توليد التركيبات.");
      return;
    }

    const basePrice = Number(formData?.get("basePrice") || 0);
    const stock = Number(formData?.get("defaultStock") || 0);
    const defaultUnitId = String(formData?.get("unitId") || "");
    const combos = cartesian(selectedGroups.map((group) => group.values.map((value) => ({ attributeId: group.attributeId, value }))));

    // Safety guard: protect the merchant (and the browser) from an explosion of variants.
    // Hard-stop beyond 300 combinations; warn between 100 and 300.
    if (combos.length > 300) {
      setMessage(`عدد التركيبات ${combos.length} كبير جداً وسيبطئ المتصفح. قلل عدد الخصائص أو قيمها — الحد الأقصى المدعوم 300 تركيبة.`);
      return;
    }

    const drafts = combos.map((combo, index) => {
      const attrs: Record<string, string> = {};
      const ids: string[] = [];
      const parts: string[] = [];
      for (const item of combo) {
        const attr = attributeById.get(item.attributeId);
        attrs[attr?.name || item.attributeId] = item.value.value;
        ids.push(item.value.id);
        parts.push(item.value.code || item.value.value);
      }
      const title = Object.entries(attrs).map(([name, value]) => `${name}: ${value}`).join(" / ") || "افتراضي";
      return {
        key: `${Date.now()}-${index}`,
        title,
        sku: parts.join("-").toUpperCase(),
        unitId: inferUnitId(attrs, defaultUnitId),
        attributeValueIds: ids,
        attributes: attrs,
        price: basePrice,
        priceAdjustment: 0,
        stockQuantity: stock,
        lowStockThreshold: 5,
        imageUrl: "",
        barcode: ""
      };
    });
    setVariants(drafts);
    const notice = drafts.length > 100
      ? ` تم توليد ${drafts.length} تركيبة — عدد كبير. تأكد من مراجعة كل تركيبة قبل الحفظ، وإذا كان كبيراً جداً قلل قيم المتغيرات.`
      : "";
    setMessage(`تم توليد ${drafts.length} تركيبة. راجع الوحدة والسعر والمخزون لكل تركيبة قبل الحفظ.${notice}`);
  }

  function updateVariant(index: number, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((variant, i) => i === index ? { ...variant, ...patch } : variant));
  }

  function resetForNextProduct() {
    formRef.current?.reset();
    setVariants([]);
    setSelectionRows([newSelectionRow()]);
    setPreviewLink(null);
    setMessage("النموذج جاهز لإضافة منتج جديد.");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const f = new FormData(formElement);
    const images = String(f.get("images") || "").split("\n").map((x) => x.trim()).filter(Boolean);
    const specifications = Object.fromEntries(String(f.get("specifications") || "").split("\n").map((line) => line.split("=").map((x) => x.trim())).filter((x) => x[0] && x[1]) as Array<[string,string]>);
    const basePrice = Number(f.get("basePrice") || 0);
    const status = String(f.get("status") || "draft");
    const codeMode = String(f.get("codeMode") || "auto");
    const manualCode = String(f.get("productCode") || "").trim();
    const unitId = String(f.get("unitId") || "");
    const finalVariants = variants.length ? variants : [{ key: "default", title: "افتراضي", sku: "", unitId, attributeValueIds: [], attributes: {}, price: basePrice, priceAdjustment: 0, stockQuantity: Number(f.get("defaultStock") || 0), lowStockThreshold: 5, imageUrl: String(f.get("mainImageUrl") || ""), barcode: "" }];
    // لا نفرض على التاجر قسماً أو وحدة أو متغيرات. يمكنه نشر منتج بسيط الآن،
    // ثم العودة لاحقاً لإضافة لون/مقاس/وحدة/تصنيف بدون أن يعيقه النظام.
    if (status === "active" && !finalVariants.some((variant) => Number(variant.price || 0) > 0) && basePrice <= 0) {
      return setMessage("لا يمكن نشر منتج بدون سعر أكبر من صفر. احفظه كمسودة أو أدخل السعر.");
    }
    if (status === "active" && codeMode === "manual" && !manualCode) {
      return setMessage("لا يمكن نشر منتج بكود يدوي بدون رقم/كود المنتج.");
    }
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/merchant/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        categoryId: f.get("categoryId") || undefined,
        name: f.get("name"),
        englishName: f.get("englishName") || undefined,
        codeMode,
        productCode: manualCode || undefined,
        barcode: f.get("barcode") || undefined,
        shortDescription: f.get("shortDescription") || undefined,
        description: f.get("description") || undefined,
        brand: f.get("brand") || undefined,
        originCountry: f.get("originCountry") || undefined,
        warranty: f.get("warranty") || undefined,
        youtubeUrl: f.get("youtubeUrl") || "",
        type: finalVariants.length > 1 ? "variable" : "simple",
        status,
        basePrice,
        mainImageUrl: f.get("mainImageUrl") || "",
        images,
        specifications,
        pricingMode: f.get("pricingMode"),
        inventoryMode: f.get("inventoryMode"),
        productCommerceType: f.get("productCommerceType") || "ONLINE_SALES",
        discountPercent: Number(f.get("discountPercent") || 0),
        variants: finalVariants.map((variant) => ({ ...variant, unitId: variant.unitId || unitId, images: variant.imageUrl ? [variant.imageUrl] : [] }))
      })
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر حفظ المنتج");
    const productSlug = json.data?.product?.slug;
    setPreviewLink(storeSlug && productSlug ? `/store/${storeSlug}/products/${productSlug}?preview=1` : null);
    setMessage("✓ تم حفظ المنتج والمتغيرات بنجاح");
    formElement.reset();
    setVariants([]);
    setSelectionRows([newSelectionRow()]);
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-6 rounded-3xl border bg-white p-6 shadow-card">
      <nav className="sticky top-3 z-20 grid gap-2 rounded-2xl border bg-white/95 p-3 shadow-sm backdrop-blur md:grid-cols-4">{([['basics','1. أساسيات الصنف'],['media','2. الوسائط والمواصفات'],['variants','3. المتغيرات والمخزون'],['review','4. المراجعة والنشر']] as const).map(([key,label])=><button key={key} type="button" onClick={()=>setWorkspaceStep(key)} className={`rounded-xl px-3 py-2 text-sm font-black transition ${workspaceStep===key?'bg-primary text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>)}</nav>
      <section className="rounded-3xl border border-violet-200 bg-gradient-to-l from-violet-50 to-white p-5">
        <div className="mb-3 text-right">
          <h2 className="text-lg font-black text-violet-950">مساعد وصف المنتج والمتغيرات</h2>
          <p className="mt-1 text-xs font-bold leading-6 text-violet-800">اكتب المنتج كما تقوله للتاجر، وسيقترح النظام الاسم والوصف والقسم والمقاسات والألوان المناسبة من إعدادات متجرك.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="مثال: قميص رجالي قطني أزرق مقاسات M L XL بسعر 12000 ومخزون 20" />
          <Button type="button" disabled={aiLoading || loading} onClick={applyProductAiSuggestion} className="min-h-20 rounded-2xl">{aiLoading ? "جارٍ التوليد..." : "توليد البيانات"}</Button>
        </div>
      </section>
      <section className={workspaceStep === "basics" ? "space-y-4" : "hidden"}><div className="grid gap-4 md:grid-cols-3">
        <Field label="اسم المنتج" name="name" required />
        <Field label="اسم المنتج بالإنجليزية" name="englishName" />
        <div className="space-y-2"><Label>التصنيف / المجموعة</Label><select name="categoryId" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">بدون تصنيف حالياً</option>{categories.map(c=><option key={c.id} value={c.id}>{"—".repeat(c.level)} {c.code} {c.name}</option>)}</select><p className="text-xs font-bold text-slate-500">إذا لم تجد القسم المطلوب، أضفه من إعدادات الأصناف والمتغيرات.</p></div>
        <div className="space-y-2"><Label>نظام الكود</Label><select name="codeMode" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="auto">تلقائي حسب التصنيف</option><option value="manual">يدوي</option></select></div>
        <Field label="كود يدوي" name="productCode" placeholder="اختياري عند اختيار الكود اليدوي" />
        <Field label="باركود" name="barcode" />
        <Field label="العلامة التجارية" name="brand" />
        <Field label="بلد المنشأ" name="originCountry" />
        <Field label="الضمان" name="warranty" />
        <Field label="السعر الأساسي" name="basePrice" type="number" required />
        <Field label="مخزون افتراضي" name="defaultStock" type="number" />
        <div className="space-y-2"><Label>وحدة البيع الافتراضية</Label><select name="unitId" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">بدون وحدة حالياً</option>{units.map((unit)=><option key={unit.id} value={unit.id}>{unitLabel(unit)}</option>)}</select><p className="text-xs font-bold text-slate-500">مثال: حبة، كيس، كرتون (20 حبة)، درزن (12 حبة). أضفها من تبويب الوحدات.</p></div>
        <Field label="نسبة الخصم" name="discountPercent" type="number" />
        <div className="space-y-2"><Label>طريقة السعر</Label><select name="pricingMode" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="independent">سعر مستقل لكل متغير</option><option value="base_adjustment">سعر أساسي + فرق</option></select></div>
        <div className="space-y-2"><Label>طريقة المخزون</Label><select name="inventoryMode" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="variant">مخزون لكل متغير</option><option value="product">مخزون عام</option></select></div>
        <div className="space-y-2"><Label>طريقة عرض/بيع الصنف</Label><select name="productCommerceType" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="ONLINE_SALES">للبيع الإلكتروني</option><option value="SHOWCASE_ONLY">للعرض والتواصل فقط</option></select><p className="text-xs font-bold text-slate-500">يمكن للمتجر أن يحتوي أصناف للبيع وأصناف للعرض فقط.</p></div>
        <div className="space-y-2"><Label>الحالة</Label><select name="status" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="draft">مسودة</option><option value="review">إرسال للمراجعة</option><option value="active">نشط</option><option value="paused">موقوف مؤقتًا</option><option value="inactive">غير نشط</option></select></div>
      </div><div className="flex justify-end"><Button type="button" onClick={()=>setWorkspaceStep("media")}>التالي: الوسائط والمواصفات</Button></div></section>

      <section className={workspaceStep === "media" ? "space-y-4" : "hidden"}><div className="grid gap-4 md:grid-cols-2">
        <MediaUrlInput label="الصورة الرئيسية: رابط أو رفع" name="mainImageUrl" storeId={storeId} folder={`stores/${storeId}/products/main`} accept="image/*" imageQualityProfile="product" />
        <Field label="رابط يوتيوب" name="youtubeUrl" placeholder="https://youtube.com/..." />
        <div className="md:col-span-2"><MediaGalleryInput label="صور إضافية: روابط أو رفع" name="images" storeId={storeId} folder={`stores/${storeId}/products/gallery`} accept="image/*" imageQualityProfile="product" /></div>
        <div className="space-y-2"><Label>وصف مختصر</Label><Textarea name="shortDescription" /></div>
        <div className="space-y-2"><Label>وصف تفصيلي</Label><Textarea name="description" /></div>
        <div className="space-y-2 md:col-span-2"><Label>المواصفات - صيغة: الاسم = القيمة</Label><Textarea name="specifications" placeholder="المادة = اكتب القيمة&#10;الضمان = اكتب القيمة" /></div>
      </div><div className="flex justify-between gap-2"><Button type="button" variant="outline" onClick={()=>setWorkspaceStep("basics")}>رجوع</Button><Button type="button" onClick={()=>setWorkspaceStep("variants")}>التالي: المتغيرات</Button></div></section>

      <section className={workspaceStep === "variants" || workspaceStep === "review" ? "space-y-4" : "hidden"}><div className="rounded-2xl border bg-slate-50 p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black">اختيار متغيرات المنتج</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">بدلاً من عرض كل المتغيرات مرة واحدة: اختر الخاصية أولاً، ثم تظهر قيم هذه الخاصية فقط. يمكنك إضافة أكثر من متغير مثل: العبوة + اللون + المقاس.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={addSelectionRow}>إضافة متغير آخر</Button>
            <Button type="button" variant="outline" onClick={() => formRef.current && generateVariants(new FormData(formRef.current))}>توليد التركيبات</Button>
          </div>
        </div>

        {!attributes.length ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">لا توجد خصائص متغيرات. أضف خاصية مثل العبوة أو اللون أو المقاس من إعدادات الأصناف والمتغيرات.</div>
        ) : (
          <div className="space-y-4">
            {selectionRows.map((row, index) => {
              const rowValues = row.attributeId ? valuesByAttribute.get(row.attributeId) || [] : [];
              return (
                <div key={row.key} className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="grid gap-3 md:grid-cols-[minmax(220px,320px)_1fr_auto] md:items-start">
                    <div className="space-y-2">
                      <Label>المتغير رقم {index + 1}</Label>
                      <select value={row.attributeId} onChange={(event) => changeSelectionAttribute(row.key, event.target.value)} className="h-11 w-full rounded-xl border bg-white px-4 text-sm">
                        <option value="">اختر المتغير</option>
                        {attributes.map((attribute) => {
                          const usedByAnotherRow = selectionRows.some((item) => item.key !== row.key && item.attributeId === attribute.id);
                          return <option key={attribute.id} value={attribute.id} disabled={usedByAnotherRow}>{attribute.name}{attribute.isRequired ? " *" : ""}</option>;
                        })}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>قيم المتغير</Label>
                      {!row.attributeId ? <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">اختر المتغير أولاً حتى تظهر قيمه هنا.</p> : !rowValues.length ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">لا توجد قيم لهذا المتغير. أضف قيمة من تبويب قيم الخصائص ثم ارجع للمنتج.</p> : <div className="flex flex-wrap gap-2">{rowValues.map((value)=><label key={value.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition ${(row.valueIds || []).includes(value.id) ? "border-primary bg-blue-50 text-primary" : "bg-white hover:bg-slate-50"}`}><input type="checkbox" checked={(row.valueIds || []).includes(value.id)} onChange={()=>toggleSelectionValue(row.key,value.id)}/>{attributeById.get(row.attributeId)?.displayType==="color" && value.colorHex ? <span className="h-4 w-4 rounded-full border" style={{backgroundColor:value.colorHex}}/>:null}{value.value}</label>)}</div>}
                    </div>
                    <Button type="button" variant="ghost" onClick={() => removeSelectionRow(row.key)} className="text-red-600">حذف السطر</Button>
                  </div>
                </div>
              );
            })}
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs font-bold leading-6 text-blue-900">
              مثال عملي: إذا كان المنتج يباع بالعبوات، أضف خاصية باسم <b>العبوة</b> وقيمها <b>كيس، كرتون، درزن</b>. ومن تبويب الوحدات أضف: <b>كرتون (20 حبة)</b> و <b>درزن (12 حبة)</b>. عند توليد التركيبات تستطيع اختيار وحدة كل تركيبة من الجدول.
            </div>
          </div>
        )}
      </div>
      {workspaceStep === "variants" ? <div className="flex justify-between gap-2"><Button type="button" variant="outline" onClick={()=>setWorkspaceStep("media")}>رجوع</Button><Button type="button" onClick={()=>setWorkspaceStep("review")}>التالي: مراجعة التركيبات</Button></div> : null}

      {variants.length ? <section className="overflow-hidden rounded-2xl border"><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-right text-sm"><thead className="bg-slate-100"><tr><th className="p-3">المتغير</th><th className="p-3">وحدة البيع</th><th className="p-3">SKU</th><th className="p-3">باركود</th><th className="p-3">السعر</th><th className="p-3">فرق السعر</th><th className="p-3">المخزون</th><th className="p-3">الصورة</th></tr></thead><tbody>{variants.map((variant,index)=><tr key={variant.key} className="border-t align-top"><td className="p-2 font-bold">{variant.title}</td><td className="p-2"><select value={variant.unitId} onChange={e=>updateVariant(index,{unitId:e.target.value})} className="h-10 min-w-40 rounded-xl border bg-white px-3 text-sm"><option value="">اختر الوحدة</option>{units.map((unit)=><option key={unit.id} value={unit.id}>{unitLabel(unit)}</option>)}</select></td><td className="p-2"><Input value={variant.sku} onChange={e=>updateVariant(index,{sku:e.target.value})}/></td><td className="p-2"><Input value={variant.barcode} onChange={e=>updateVariant(index,{barcode:e.target.value})}/></td><td className="p-2"><Input type="number" value={variant.price} onChange={e=>updateVariant(index,{price:Number(e.target.value)})}/></td><td className="p-2"><Input type="number" value={variant.priceAdjustment} onChange={e=>updateVariant(index,{priceAdjustment:Number(e.target.value)})}/></td><td className="p-2"><Input type="number" value={variant.stockQuantity} onChange={e=>updateVariant(index,{stockQuantity:Number(e.target.value)})}/></td><td className="p-2"><MediaUrlInput label="" name={`variant-image-${index}`} value={variant.imageUrl} onValueChange={(value)=>updateVariant(index,{imageUrl:value})} storeId={storeId} folder={`stores/${storeId}/products/variants`} accept="image/*" imageQualityProfile="product" /></td></tr>)}</tbody></table></div></section> : null}

      <div className={workspaceStep === "review" ? "flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4" : "hidden"}><Button type="button" variant="outline" onClick={()=>setWorkspaceStep("variants")}>رجوع للمتغيرات</Button><Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ المنتج"}</Button>{previewLink ? <Button type="button" variant="secondary" onClick={resetForNextProduct}>إضافة منتج جديد</Button> : null}{previewLink ? <Button asChild variant="outline"><a href={previewLink} target="_blank">معاينة المنتج</a></Button> : null}{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
      </section>
    </form>
  );
}

function cartesian<T>(arrays: T[][]): T[][] { return arrays.reduce<T[][]>((acc, curr) => acc.flatMap(a => curr.map(c => [...a, c])), [[]]); }
function Field({ label, name, type="text", required=false, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) { return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} required={required} placeholder={placeholder||""}/></div> }
