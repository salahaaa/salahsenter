"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyPlus, Edit3, Eye, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpCard } from "@/components/ui/help-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaGalleryInput } from "@/components/media/media-gallery-input";
import { MediaUrlInput } from "@/components/media/media-url-input";

type Category = { id: string; name: string; code: string | null; level: number };
type Attribute = { id: string; name: string; code: string; displayType: string };
type AttributeValue = { id: string; attributeId: string; value: string; colorHex: string | null };
type Unit = { id: string; name: string; symbol: string | null };
type SimpleRef = { id: string; name: string };
type Product = {
  id: string;
  storeId: string;
  name: string;
  englishName: string | null;
  slug: string;
  categoryId: string | null;
  productCode: string | null;
  codeMode: string;
  barcode: string | null;
  shortDescription: string | null;
  description: string | null;
  brand: string | null;
  originCountry: string | null;
  warranty: string | null;
  youtubeUrl: string | null;
  status: string;
  basePrice: string | null;
  mainImageUrl: string | null;
  images: string[];
  specifications: Record<string, string>;
  pricingMode: string;
  inventoryMode: string;
  productCommerceType?: string | null;
  discountPercent: string | number;
};
type VariantRow = {
  id: string;
  sku: string;
  barcode: string | null;
  title: string | null;
  price: string;
  compareAtPrice: string | null;
  priceAdjustment: string;
  stockQuantity: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  images: string[];
  attributes: Record<string, string>;
  attributeValueIds?: string[];
  unitId: string | null;
  sizeId: string | null;
  colorId: string | null;
  isActive: boolean;
};
type VariantDraft = VariantRow & { localKey: string };

function specsToText(specs: Record<string, string>) {
  return Object.entries(specs || {}).map(([key, value]) => `${key} = ${value}`).join("\n");
}
function textToSpecs(value: string) {
  return Object.fromEntries(value.split("\n").map((line) => line.split("=").map((part) => part.trim())).filter((parts) => parts[0] && parts[1]) as Array<[string, string]>);
}
function textToImages(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}
function unitLabel(u: Unit) {
  return u.symbol ? `${u.name} (${u.symbol})` : u.name;
}

export function ProductEditForm({ product, variants, categories, attributes, attributeValues, units, sizes, colors, storeSlug }: { product: Product; variants: VariantRow[]; categories: Category[]; attributes: Attribute[]; attributeValues: AttributeValue[]; units: Unit[]; sizes: SimpleRef[]; colors: SimpleRef[]; storeSlug: string }) {
  const router = useRouter();
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>(variants.map((variant) => ({ ...variant, localKey: variant.id })));
  const [mainImageUrl, setMainImageUrl] = useState(product.mainImageUrl || "");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quickAttributeName, setQuickAttributeName] = useState("اللون");
  const [quickAttributeValue, setQuickAttributeValue] = useState("");
  const [quickColorHex, setQuickColorHex] = useState("#000000");
  const [bulkPriceDelta, setBulkPriceDelta] = useState("");
  const [bulkStockDelta, setBulkStockDelta] = useState("");
  const previewLink = `/store/${storeSlug}/products/${product.slug}?preview=1`;

  const activeVariants = useMemo(() => variantDrafts.filter((variant) => variant.isActive).length, [variantDrafts]);
  const duplicateSkus = useMemo(() => {
    const seen = new Set<string>(); const duplicates = new Set<string>();
    for (const variant of variantDrafts.filter((item) => item.isActive)) { const sku = variant.sku.trim().toLowerCase(); if (!sku) continue; if (seen.has(sku)) duplicates.add(sku); seen.add(sku); }
    return duplicates;
  }, [variantDrafts]);
  const valuesByAttribute = useMemo(() => {
    const map = new Map<string, AttributeValue[]>();
    for (const value of attributeValues) map.set(value.attributeId, [...(map.get(value.attributeId) || []), value]);
    return map;
  }, [attributeValues]);
  const attributeById = useMemo(() => new Map(attributes.map((a) => [a.id, a])), [attributes]);

  function updateVariant(index: number, patch: Partial<VariantDraft>) {
    setVariantDrafts((current) => current.map((variant, i) => i === index ? { ...variant, ...patch } : variant));
  }

  /** Rebuild a variant's `attributes` map (name → value text) from its selected value ids,
   *  so the storefront display + title stay consistent with the relational links. */
  function rebuildAttributesFromValues(index: number, valueIds: string[]) {
    const attrs: Record<string, string> = {};
    for (const valueId of valueIds) {
      const value = attributeValues.find((v) => v.id === valueId);
      if (!value) continue;
      const attr = attributeById.get(value.attributeId);
      if (attr) attrs[attr.name] = value.value;
    }
    updateVariant(index, { attributeValueIds: valueIds, attributes: attrs, title: Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(" / ") || "افتراضي" });
  }

  function toggleVariantValue(index: number, valueId: string) {
    const draft = variantDrafts[index];
    if (!draft) return;
    const value = attributeValues.find((item) => item.id === valueId);
    const current = new Set(draft.attributeValueIds || []);
    if (current.has(valueId)) {
      current.delete(valueId);
    } else {
      // كل متغير يأخذ قيمة واحدة فقط من نفس الخاصية. إذا اختار التاجر لوناً جديداً
      // نستبدل اللون القديم فقط، مع إبقاء المقاس/العبوة/أي خصائص أخرى كما هي.
      if (value) {
        for (const selectedId of [...current]) {
          const selected = attributeValues.find((item) => item.id === selectedId);
          if (selected?.attributeId === value.attributeId) current.delete(selectedId);
        }
      }
      current.add(valueId);
    }
    rebuildAttributesFromValues(index, [...current]);
  }

  function normalizeCode(value: string) {
    return value.trim().toLowerCase().replace(/[^a-z0-9_\u0600-\u06ff]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60) || `attr_${Date.now()}`;
  }

  async function createQuickAttributeValue() {
    const attrName = quickAttributeName.trim();
    const val = quickAttributeValue.trim();
    if (!attrName || !val) return setMessage("اكتب اسم الخاصية والقيمة أولاً، مثل: اللون = أحمر");
    setLoading(true);
    setMessage(null);
    try {
      let attr = attributes.find((item) => item.name.trim().toLowerCase() === attrName.toLowerCase());
      if (!attr) {
        const attrResponse = await fetch("/api/merchant/product-taxonomy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "attribute", storeId: product.storeId, name: attrName, code: normalizeCode(attrName), displayType: /لون|color/i.test(attrName) ? "color" : "button", isVariantOption: true, isRequired: false, sortOrder: attributes.length, isActive: true })
        });
        const attrJson = await attrResponse.json().catch(() => ({}));
        if (!attrResponse.ok) throw new Error(attrJson.message || "تعذر إنشاء الخاصية");
        attr = attrJson.data?.item;
      }
      const valueResponse = await fetch("/api/merchant/product-taxonomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "attributeValue", attributeId: attr!.id, value: val, code: normalizeCode(val), colorHex: /لون|color/i.test(attrName) ? quickColorHex : undefined, sortOrder: 0, isActive: true })
      });
      const valueJson = await valueResponse.json().catch(() => ({}));
      if (!valueResponse.ok) throw new Error(valueJson.message || "تعذر إنشاء قيمة الخاصية");
      setQuickAttributeValue("");
      setMessage("✓ تم إضافة الخاصية/القيمة. يمكنك الآن اختيارها بعد تحديث البيانات.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إضافة الخاصية");
    } finally {
      setLoading(false);
    }
  }

  function addVariant() {
    setVariantDrafts((current) => [...current, {
      id: "",
      localKey: `new-${Date.now()}`,
      sku: "",
      barcode: "",
      title: "متغير جديد",
      price: product.basePrice || "0",
      compareAtPrice: null,
      priceAdjustment: "0",
      stockQuantity: 0,
      lowStockThreshold: 5,
      imageUrl: "",
      images: [],
      attributes: {},
      attributeValueIds: [],
      unitId: null,
      sizeId: null,
      colorId: null,
      isActive: true
    }]);
  }

  function applyVariantMatrixBulk() {
    const priceDelta = Number(bulkPriceDelta || 0); const stockDelta = Number(bulkStockDelta || 0);
    if (!Number.isFinite(priceDelta) || !Number.isFinite(stockDelta) || (!priceDelta && !stockDelta)) return setMessage("أدخل فرق سعر أو فرق مخزون لتطبيقه على المتغيرات النشطة.");
    setVariantDrafts((current) => current.map((variant) => variant.isActive ? { ...variant, price: String(Math.max(0, Number(variant.price || 0) + priceDelta)), stockQuantity: Math.max(0, Number(variant.stockQuantity || 0) + stockDelta) } : variant));
    setMessage("✓ تم تطبيق التعديل الجماعي على المتغيرات النشطة؛ احفظ لتثبيت السجل.");
  }

  function cloneVariant(index: number) {
    const source = variantDrafts[index];
    if (!source) return;
    const baseSku = source.sku ? `${source.sku}-COPY` : `VAR-${Date.now()}`;
    setVariantDrafts((current) => [...current, { ...source, id: "", localKey: `clone-${Date.now()}`, sku: baseSku, barcode: "", title: `${source.title || "متغير"} (نسخة)`, stockQuantity: 0, isActive: true }]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    if (duplicateSkus.size) { setMessage(`يوجد SKU مكرر: ${[...duplicateSkus].join("، ")}`); return; }
    setLoading(true);
    setMessage(null);

    const payload = {
      categoryId: f.get("categoryId") || null,
      name: f.get("name"),
      englishName: f.get("englishName") || null,
      slug: f.get("slug") || product.slug,
      productCode: f.get("productCode") || null,
      codeMode: f.get("codeMode") || "auto",
      barcode: f.get("barcode") || null,
      shortDescription: f.get("shortDescription") || null,
      description: f.get("description") || null,
      brand: f.get("brand") || null,
      originCountry: f.get("originCountry") || null,
      warranty: f.get("warranty") || null,
      youtubeUrl: f.get("youtubeUrl") || "",
      status: f.get("status"),
      basePrice: Number(f.get("basePrice") || 0),
      mainImageUrl,
      images: textToImages(String(f.get("images") || "")),
      specifications: textToSpecs(String(f.get("specifications") || "")),
      pricingMode: f.get("pricingMode"),
      inventoryMode: f.get("inventoryMode"),
      productCommerceType: f.get("productCommerceType") || product.productCommerceType || "ONLINE_SALES",
      discountPercent: Number(f.get("discountPercent") || 0),
      variants: variantDrafts.map((variant) => ({
        id: variant.id || undefined,
        sku: variant.sku,
        barcode: variant.barcode || undefined,
        title: variant.title || "افتراضي",
        price: Number(variant.price || 0),
        compareAtPrice: variant.compareAtPrice ? Number(variant.compareAtPrice) : null,
        priceAdjustment: Number(variant.priceAdjustment || 0),
        stockQuantity: Number(variant.stockQuantity || 0),
        lowStockThreshold: Number(variant.lowStockThreshold || 0),
        imageUrl: variant.imageUrl || "",
        images: variant.imageUrl ? [variant.imageUrl] : [],
        attributes: variant.attributes || {},
        attributeValueIds: variant.attributeValueIds || [],
        unitId: variant.unitId || null,
        sizeId: variant.sizeId || null,
        colorId: variant.colorId || null,
        isActive: Boolean(variant.isActive)
      }))
    };

    const response = await fetch(`/api/merchant/products/${product.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر تعديل المنتج");
    setMessage("✓ تم تعديل المنتج بالكامل بنجاح");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <HelpCard title="شرح سريع لتعديل المنتج">
        <p><b>تعديل اللون/المقاس/العبوة:</b> في قسم المتغيرات، اضغط على قيم الخاصية لتغييرها أو إضافتها أو إزالتها لكل متغيّر. التغيير يُحفظ عند الضغط على «حفظ كل التعديلات».</p>
        <p><b>إضافة لون نسي:</b> اضغط «إضافة متغير» ثم اختر اللون/المقاس الجديد من القوائم، اكتب السعر والمخزون، ثم احفظ.</p>
        <p><b>تعطيل متغيّر بدلاً من حذفه:</b> أزل خيار «نشط» حتى لا تتأثر الطلبات القديمة المسجّلة على هذا المتغيّر.</p>
      </HelpCard>

      <section className="rounded-3xl border bg-white p-6 shadow-card">
        <h2 className="mb-5 flex items-center gap-2 text-xl font-black text-slate-950"><Edit3 className="h-5 w-5 text-blue-600" /> البيانات الأساسية</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="اسم المنتج" name="name" defaultValue={product.name} required />
          <Field label="الاسم الإنجليزي" name="englishName" defaultValue={product.englishName || ""} />
          <div className="space-y-2"><Label>التصنيف</Label><select name="categoryId" defaultValue={product.categoryId || ""} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">بدون تصنيف</option>{categories.map((category) => <option key={category.id} value={category.id}>{"".padStart(category.level, "—")} {category.code || ""} {category.name}</option>)}</select></div>
          <Field label="Slug الرابط" name="slug" defaultValue={product.slug} />
          <div className="space-y-2"><Label>نظام الكود</Label><select name="codeMode" defaultValue={product.codeMode} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="auto">تلقائي</option><option value="manual">يدوي</option></select></div>
          <Field label="كود المنتج" name="productCode" defaultValue={product.productCode || ""} />
          <Field label="باركود" name="barcode" defaultValue={product.barcode || ""} />
          <Field label="العلامة التجارية" name="brand" defaultValue={product.brand || ""} />
          <Field label="بلد المنشأ" name="originCountry" defaultValue={product.originCountry || ""} />
          <Field label="الضمان" name="warranty" defaultValue={product.warranty || ""} />
          <Field label="السعر الأساسي" name="basePrice" type="number" defaultValue={product.basePrice || "0"} />
          <Field label="نسبة الخصم" name="discountPercent" type="number" defaultValue={String(product.discountPercent || 0)} />
          <div className="space-y-2"><Label>الحالة</Label><select name="status" defaultValue={product.status} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="draft">مسودة</option><option value="review">قيد المراجعة</option><option value="active">نشط</option><option value="paused">موقوف مؤقتًا</option><option value="inactive">غير نشط</option><option value="archived">مؤرشف</option></select></div>
          <div className="space-y-2"><Label>طريقة السعر</Label><select name="pricingMode" defaultValue={product.pricingMode} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="independent">سعر مستقل لكل متغير</option><option value="base_adjustment">سعر أساسي + فرق</option></select></div>
          <div className="space-y-2"><Label>طريقة المخزون</Label><select name="inventoryMode" defaultValue={product.inventoryMode} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="variant">مخزون لكل متغير</option><option value="product">مخزون عام</option></select></div>
          <div className="space-y-2"><Label>طريقة عرض/بيع الصنف</Label><select name="productCommerceType" defaultValue={product.productCommerceType || "ONLINE_SALES"} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="ONLINE_SALES">للبيع الإلكتروني</option><option value="SHOWCASE_ONLY">للعرض والتواصل فقط</option></select></div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-card">
        <h2 className="mb-5 text-xl font-black text-slate-950">الصور والوصف</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <MediaUrlInput label="الصورة الرئيسية" name="mainImageUrl_control" value={mainImageUrl} onValueChange={setMainImageUrl} storeId={product.storeId} folder={`stores/${product.storeId}/products/main`} accept="image/*" imageQualityProfile="product" />
          <Field label="رابط يوتيوب" name="youtubeUrl" defaultValue={product.youtubeUrl || ""} />
          <div className="md:col-span-2"><MediaGalleryInput label="معرض الصور" name="images" defaultValue={(product.images || []).join("\n")} storeId={product.storeId} folder={`stores/${product.storeId}/products/gallery`} accept="image/*" imageQualityProfile="product" /></div>
          <div className="space-y-2"><Label>وصف مختصر</Label><Textarea name="shortDescription" defaultValue={product.shortDescription || ""} /></div>
          <div className="space-y-2"><Label>وصف تفصيلي</Label><Textarea name="description" defaultValue={product.description || ""} /></div>
          <div className="space-y-2 md:col-span-2"><Label>المواصفات - صيغة: الاسم = القيمة</Label><Textarea name="specifications" defaultValue={specsToText(product.specifications)} /></div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-card">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-black text-slate-950">المتغيرات والأسعار والمخزون</h2><p className="mt-1 text-sm text-slate-500">المتغيرات النشطة التي تظهر للعملاء: {activeVariants} — يمكنك تغيير اللون والمقاس والعبوة لكل متغيّر.</p></div>
          <Button type="button" variant="outline" onClick={addVariant}><Plus className="h-4 w-4" /> إضافة متغير</Button>
        </div>

        <div className="mb-5 grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 md:grid-cols-[1fr_180px_180px_auto]"><div><h3 className="font-black text-emerald-950">Matrix Bulk Editor</h3><p className="mt-1 text-xs font-bold text-emerald-800">طبّق فرق سعر أو مخزون على كل المتغيرات النشطة، ثم راجع الجدول واحفظ.</p></div><Input type="number" value={bulkPriceDelta} onChange={(event) => setBulkPriceDelta(event.target.value)} placeholder="فرق السعر ±"/><Input type="number" value={bulkStockDelta} onChange={(event) => setBulkStockDelta(event.target.value)} placeholder="فرق المخزون ±"/><Button type="button" onClick={applyVariantMatrixBulk}>تطبيق على الكل</Button></div>
        <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-blue-950">إضافة خاصية أو قيمة ناقصة بسرعة</h3>
              <p className="mt-1 text-xs font-bold text-blue-800">إذا نشرت المنتج ونسيت اللون أو المقاس، أضفه هنا ثم اختره للمتغيرات بدون مغادرة الشاشة.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => router.push("/merchant/product-taxonomy?tab=attributes")}>فتح إدارة الخصائص الكاملة</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-[180px_1fr_120px_auto]">
            <Input value={quickAttributeName} onChange={(e) => setQuickAttributeName(e.target.value)} placeholder="الخاصية: اللون" />
            <Input value={quickAttributeValue} onChange={(e) => setQuickAttributeValue(e.target.value)} placeholder="القيمة: أحمر / XL / كرتون" />
            <Input type="color" value={quickColorHex} onChange={(e) => setQuickColorHex(e.target.value)} title="لون اختياري" />
            <Button type="button" disabled={loading} onClick={createQuickAttributeValue}>إضافة للقوائم</Button>
          </div>
        </div>

        <div className="space-y-4">
          {variantDrafts.map((variant, index) => {
            const selectedValues = new Set(variant.attributeValueIds || []);
            return (
              <div key={variant.localKey} className={`rounded-2xl border p-4 ${variant.isActive ? "bg-white" : "bg-slate-50 opacity-70"}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-black"><input type="checkbox" checked={variant.isActive} onChange={(event) => updateVariant(index, { isActive: event.target.checked })} /> {variant.id ? "متغيّر موجود" : "متغيّر جديد"} — {variant.title || "بدون عنوان"}</label>
                  <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => cloneVariant(index)}><CopyPlus className="h-4 w-4" /> استنساخ</Button><Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => updateVariant(index, { isActive: false })}><Trash2 className="h-4 w-4" /> تعطيل</Button></div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="العنوان" value={variant.title || ""} onChange={(v) => updateVariant(index, { title: v })} />
                  <div className="space-y-2"><Field label="SKU" value={variant.sku} onChange={(v) => updateVariant(index, { sku: v })} />{variant.sku.trim() && duplicateSkus.has(variant.sku.trim().toLowerCase()) ? <p className="text-xs font-black text-red-600">SKU مكرر — غيّره قبل الحفظ</p> : null}</div>
                  <Field label="باركود" value={variant.barcode || ""} onChange={(v) => updateVariant(index, { barcode: v })} />
                  <div className="space-y-2"><Label>وحدة البيع</Label><select value={variant.unitId || ""} onChange={(e) => updateVariant(index, { unitId: e.target.value || null })} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">بدون</option>{units.map((u) => <option key={u.id} value={u.id}>{unitLabel(u)}</option>)}</select></div>
                  <Field label="السعر" type="number" value={String(variant.price)} onChange={(v) => updateVariant(index, { price: v })} />
                  <Field label="سعر قبل الخصم" type="number" value={variant.compareAtPrice || ""} onChange={(v) => updateVariant(index, { compareAtPrice: v })} />
                  <Field label="المخزون" type="number" value={String(variant.stockQuantity)} onChange={(v) => updateVariant(index, { stockQuantity: Number(v) })} />
                  <Field label="حد النفاد" type="number" value={String(variant.lowStockThreshold)} onChange={(v) => updateVariant(index, { lowStockThreshold: Number(v) })} />
                </div>

                {/* Attribute editor — the core fix: the merchant can now change/add/remove the
                    color/size/pack of any existing variant, not just create-only. */}
                <div className="mt-4 rounded-xl border bg-slate-50 p-3">
                  <Label className="mb-2 block">الخصائص (اللون / المقاس / العبوة ...)</Label>
                  {!attributes.length ? (
                    <p className="text-sm font-bold text-amber-700">لا توجد خصائص معرّفة لمتجرك. أضف خاصية مثل «اللون» من صفحة الأصناف والمتغيرات ثم ارجع هنا.</p>
                  ) : (
                    <div className="space-y-3">
                      {attributes.map((attr) => {
                        const vals = valuesByAttribute.get(attr.id) || [];
                        return (
                          <div key={attr.id}>
                            <p className="mb-1 text-xs font-black text-slate-600">{attr.name}</p>
                            {!vals.length ? (
                              <p className="text-xs text-slate-400">لا توجد قيم لهذه الخاصية.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {vals.map((val) => {
                                  const active = selectedValues.has(val.id);
                                  return (
                                    <button key={val.id} type="button" onClick={() => toggleVariantValue(index, val.id)} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
                                      {attr.displayType === "color" && val.colorHex ? <span className="h-3.5 w-3.5 rounded-full border" style={{ backgroundColor: val.colorHex }} /> : null}
                                      {val.value}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <MediaUrlInput label="صورة المتغيّر (اختياري)" name={`variant-image-${index}`} value={variant.imageUrl || ""} onValueChange={(value) => updateVariant(index, { imageUrl: value })} storeId={product.storeId} folder={`stores/${product.storeId}/products/variants`} accept="image/*" imageQualityProfile="product" />
                </div>
              </div>
            );
          })}
          {!variantDrafts.length ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">لا توجد متغيرات. اضغط «إضافة متغير».</p> : null}
        </div>
      </section>

      <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-3xl border bg-white/95 p-4 shadow-soft backdrop-blur-xl">
        <Button disabled={loading}><Save className="h-4 w-4" /> {loading ? "جارٍ الحفظ...)" : "حفظ كل التعديلات"}</Button>
        <Button asChild variant="outline"><a href={previewLink} target="_blank"><Eye className="h-4 w-4" /> معاينة المنتج</a></Button>
        {message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}
      </div>
    </form>
  );
}

function Field({ label, name, type = "text", defaultValue = "", value, onChange, required = false }: { label: string; name?: string; type?: string; defaultValue?: string; value?: string; onChange?: (value: string) => void; required?: boolean }) {
  return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} defaultValue={defaultValue} value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} required={required} /></div>;
}
