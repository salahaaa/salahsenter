"use client";

import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import Link from "next/link";
import { Layers3, PackageCheck, Palette, Ruler, Search, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type ProductCommerceType = "ONLINE_SALES" | "SHOWCASE_ONLY";
type StarterProduct = { name: string; category: string; description?: string; attributes?: Record<string, string> };
type Template = {
  key: string;
  title: string;
  description: string;
  notice: string | null;
  categories: string[];
  units: Array<{ name: string; symbol?: string }>;
  attributes: Array<{ name: string; displayType: string; values: string[] }>;
  sizes: string[];
  colors: Array<{ name: string; hexCode: string }>;
  starterProducts: StarterProduct[];
  source: "system" | "admin";
  version: number;
  unitsCount: number;
  attributesCount: number;
  sizesCount: number;
  colorsCount: number;
  recommended: boolean;
};
type ApplySummary = { categories: number; units: number; sizes: number; colors: number; attributes: number; values: number; updated: number };

function modesFor(template: Template | undefined): Record<number, ProductCommerceType> {
  return Object.fromEntries((template?.starterProducts || []).map((_, index) => [index, "ONLINE_SALES" as ProductCommerceType]));
}

export function ActivityTemplateSmartPanel() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectionLocked, setSelectionLocked] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [includeStarterProducts, setIncludeStarterProducts] = useState(false);
  const [starterProductModes, setStarterProductModes] = useState<Record<number, ProductCommerceType>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/merchant/activity-templates", { cache: "no-store" })
      .then(async (response) => ({ response, json: await response.json().catch(() => ({})) }))
      .then(({ response, json }) => {
        if (!active) return;
        if (!response.ok) {
          setMessage(json.message || "تعذر تحميل القوالب");
          return;
        }
        const rows = (json.data?.templates || []) as Template[];
        const selected = rows.find((item) => item.recommended) || rows[0];
        setTemplates(rows);
        setSelectionLocked(Boolean(json.data?.selectionLocked));
        setSelectedKey(selected?.key || null);
        setStarterProductModes(modesFor(selected));
      })
      .catch(() => active && setMessage("تعذر الاتصال بالقوالب"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const visible = useMemo(
    () => templates.filter((template) => `${template.title} ${template.description} ${template.categories.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())),
    [templates, query]
  );
  const selected = templates.find((template) => template.key === selectedKey) || visible[0] || null;

  function selectTemplate(template: Template) {
    setSelectedKey(template.key);
    setConfirmed(false);
    setIncludeStarterProducts(false);
    setStarterProductModes(modesFor(template));
  }

  function setAllStarterModes(mode: ProductCommerceType) {
    if (!selected) return;
    setStarterProductModes(Object.fromEntries(selected.starterProducts.map((_, index) => [index, mode])));
  }

  async function applyTemplate() {
    if (!selected || !confirmed) return;
    setApplying(true);
    setMessage(null);
    const response = await fetch("/api/merchant/activity-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateKey: selected.key,
        includeStarterProducts,
        starterProductModes: selected.starterProducts.map((_, index) => starterProductModes[index] || "ONLINE_SALES")
      })
    });
    const json = await response.json().catch(() => ({}));
    setApplying(false);
    if (!response.ok) return setMessage(json.message || "تعذر تطبيق القالب");
    const summary = json.data?.summary as ApplySummary | undefined;
    const starter = json.data?.starter as { created?: number; skipped?: number; failed?: number } | undefined;
    setMessage(summary ? `✓ تم تطبيق ${selected.title}: ${summary.categories} أقسام، ${summary.units} وحدات، ${summary.attributes} خصائص و${summary.values} قيم.${starter ? ` منتجات البداية: ${starter.created || 0} مسودات، ${starter.skipped || 0} متجاوزة، ${starter.failed || 0} تحتاج مراجعة.` : " لم يتم إنشاء منتجات أو مخزون."}` : "✓ تم تطبيق القالب");
    setConfirmed(false);
  }

  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-card">
      <div className="border-b bg-gradient-to-l from-blue-50 via-white to-violet-50 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700"><Sparkles className="h-3.5 w-3.5" /> قوالب جاهزة للنشاط</div>
            <h2 className="text-xl font-black text-slate-950">اختر قالباً ثم راجع ما سيضاف قبل التطبيق</h2>
            <p className="mt-1 max-w-3xl text-sm leading-7 text-slate-500">القالب يجهز taxonomy والمتغيرات فقط. لا ينشئ منتجات أو أسعاراً أو مخزوناً أو قيوداً مالية، ولا يحذف إعداداتك الحالية.</p>
            {selectionLocked ? <p className="mt-2 text-xs font-black text-emerald-700">هذا المتجر مقيّد بقطاعه المحدد في طلب فتح المتجر؛ لا تظهر قطاعات أخرى.</p> : null}
          </div>
          <Badge variant="outline">{templates.length} قوالب</Badge>
        </div>
      </div>
      <div className="grid min-h-[480px] lg:grid-cols-[370px_1fr]">
        <aside className="border-b bg-slate-50/70 p-4 lg:border-l lg:border-b-0">
          <div className="relative mb-4"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pr-9" placeholder="ابحث في القطاع المختار" /></div>
          <div className="max-h-[500px] space-y-2 overflow-y-auto pr-1">
            {loading ? <p className="p-4 text-sm font-bold text-slate-500">جارٍ تحميل القوالب...</p> : visible.map((template) => <button key={template.key} type="button" onClick={() => selectTemplate(template)} className={`w-full rounded-2xl border p-4 text-right transition ${selected?.key === template.key ? "border-blue-400 bg-blue-50 shadow-sm" : "bg-white hover:border-slate-300 hover:bg-slate-50"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{template.title}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{template.description}</p></div>{template.recommended ? <Badge className="shrink-0 bg-emerald-600 text-white">قطاع المتجر</Badge> : null}</div><div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black text-slate-500"><span>أقسام {template.categories.length}</span><span>وحدات {template.unitsCount}</span><span>خصائص {template.attributesCount}</span></div></button>)}
            {!loading && !visible.length ? <p className="rounded-2xl border border-dashed p-4 text-sm font-bold text-slate-500">لا توجد نتيجة مطابقة. إن كان قطاع النشاط معطلاً، راجع الإدارة.</p> : null}
          </div>
        </aside>
        <div className="p-5 md:p-7">
          {selected ? <TemplatePreview template={selected} confirmed={confirmed} setConfirmed={setConfirmed} includeStarterProducts={includeStarterProducts} setIncludeStarterProducts={setIncludeStarterProducts} starterProductModes={starterProductModes} setStarterProductModes={setStarterProductModes} onSetAllStarterModes={setAllStarterModes} applying={applying} onApply={applyTemplate} /> : <div className="grid h-full place-items-center text-center text-slate-400"><Layers3 className="mb-3 h-10 w-10" /><p className="font-bold">لا يوجد قالب نشط لهذا القطاع حالياً.</p></div>}
          {message ? <p className={`mt-5 rounded-2xl border p-4 text-sm font-bold ${message.startsWith("✓") ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{message}</p> : null}
        </div>
      </div>
    </section>
  );
}

function TemplatePreview({
  template,
  confirmed,
  setConfirmed,
  includeStarterProducts,
  setIncludeStarterProducts,
  starterProductModes,
  setStarterProductModes,
  onSetAllStarterModes,
  applying,
  onApply
}: {
  template: Template;
  confirmed: boolean;
  setConfirmed: (value: boolean) => void;
  includeStarterProducts: boolean;
  setIncludeStarterProducts: (value: boolean) => void;
  starterProductModes: Record<number, ProductCommerceType>;
  setStarterProductModes: Dispatch<SetStateAction<Record<number, ProductCommerceType>>>;
  onSetAllStarterModes: (mode: ProductCommerceType) => void;
  applying: boolean;
  onApply: () => void;
}) {
  const starterModes = template.starterProducts.map((_, index) => starterProductModes[index] || "ONLINE_SALES");
  const uniformStarterMode = starterModes.every((mode) => mode === "ONLINE_SALES") ? "ONLINE_SALES" : starterModes.every((mode) => mode === "SHOWCASE_ONLY") ? "SHOWCASE_ONLY" : "MIXED";
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-black text-blue-600">معاينة القالب</p><h3 className="mt-1 text-3xl font-black text-slate-950">{template.title}</h3><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{template.description}</p></div>{template.recommended ? <Badge className="bg-emerald-600 text-white">قطاع المتجر المحدد</Badge> : null}</div>
    {template.notice ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900"><ShieldCheck className="ml-1 inline h-4 w-4" />{template.notice}</div> : null}
    <div className="grid gap-4 lg:grid-cols-2"><PreviewBlock icon={<Layers3 className="h-5 w-5" />} title="الأقسام التي ستضاف أو تحدث"><div className="flex flex-wrap gap-2">{template.categories.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}</div></PreviewBlock><PreviewBlock icon={<PackageCheck className="h-5 w-5" />} title="وحدات البيع"><div className="space-y-2">{template.units.map((item) => <div key={item.name} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm font-bold"><span>{item.name}</span><span className="text-xs text-slate-500">{item.symbol || "—"}</span></div>)}</div></PreviewBlock><PreviewBlock icon={<Ruler className="h-5 w-5" />} title="الخصائص والمتغيرات"><div className="space-y-3">{template.attributes.map((attribute) => <div key={attribute.name} className="rounded-xl bg-slate-50 p-3"><p className="font-black text-slate-900">{attribute.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{attribute.values.join("، ")}</p></div>)}</div></PreviewBlock><PreviewBlock icon={<Palette className="h-5 w-5" />} title="المقاسات والألوان">{template.sizes.length ? <p className="text-sm font-bold text-slate-600">المقاسات: {template.sizes.join("، ")}</p> : <p className="text-sm text-slate-500">لا توجد مقاسات افتراضية لهذا النشاط.</p>}{template.colors.length ? <div className="mt-3 flex flex-wrap gap-2">{template.colors.map((color) => <span key={color.name} className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs font-black"><span className="h-3 w-3 rounded-full border" style={{ background: color.hexCode }} />{color.name}</span>)}</div> : null}</PreviewBlock></div>
    {template.starterProducts.length ? <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><label className="flex items-start gap-3 text-sm font-bold text-blue-900"><input className="mt-1" type="checkbox" checked={includeStarterProducts} onChange={(event) => setIncludeStarterProducts(event.target.checked)} /><span>إضافة {template.starterProducts.length} منتجات بداية كمسودات فقط (سعر ومخزون صفر، غير منشورة).</span></label>{includeStarterProducts ? <div className="mt-4 space-y-3"><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white/80 p-3"><p className="text-xs font-black text-slate-700">حدد نوع كل منتج قبل إنشائه كمسودة. يمكن تعديله لاحقاً من بطاقة المنتج.</p><select aria-label="تعيين نوع كل منتجات البداية" value={uniformStarterMode} onChange={(event) => event.target.value !== "MIXED" && onSetAllStarterModes(event.target.value as ProductCommerceType)} className="h-9 rounded-lg border bg-white px-2 text-xs font-bold"><option value="ONLINE_SALES">اجعل الكل للبيع الإلكتروني</option><option value="SHOWCASE_ONLY">اجعل الكل للعرض والتواصل</option>{uniformStarterMode === "MIXED" ? <option value="MIXED">تحديد مختلط لكل منتج</option> : null}</select></div><div className="space-y-2">{template.starterProducts.map((product, index) => <div key={`${product.name}-${product.category}-${index}`} className="grid gap-2 rounded-xl border border-blue-100 bg-white p-3 md:grid-cols-[1fr_220px] md:items-center"><div><p className="text-sm font-black text-slate-900">{product.name}</p><p className="mt-1 text-xs text-slate-500">{product.category}{product.description ? ` — ${product.description}` : ""}</p></div><select aria-label={`نوع ${product.name}`} value={starterProductModes[index] || "ONLINE_SALES"} onChange={(event) => setStarterProductModes((current) => ({ ...current, [index]: event.target.value as ProductCommerceType }))} className="h-10 rounded-xl border bg-white px-3 text-sm font-bold"><option value="ONLINE_SALES">للبيع الإلكتروني: سلة وشراء</option><option value="SHOWCASE_ONLY">عرض وتواصل فقط: بلا سلة</option></select></div>)}</div><p className="text-xs font-bold leading-6 text-blue-800">«للبيع الإلكتروني» لا ينشر المنتج ولا يضع سعراً أو مخزوناً؛ «عرض وتواصل فقط» يمنع السلة والشراء عند نشره ويُظهر وسائل تواصل المتجر.</p></div> : null}</div> : null}
    <label className="flex items-start gap-3 rounded-2xl border bg-slate-50 p-4 text-sm font-bold text-slate-700"><input className="mt-1" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>راجعت المعاينة وأفهم أن التطبيق يضيف أو يحدّث التصنيفات والوحدات والخصائص فقط. ومنتجات البداية - إن اخترتها - تبقى مسودات بسعر ومخزون صفر ولا تُنشر أو تنشئ التزامات مالية.</span></label>
    <div className="flex flex-wrap gap-3"><Button type="button" disabled={!confirmed || applying} onClick={onApply}>{applying ? "جارٍ تطبيق القالب..." : <><Wand2 className="h-4 w-4" /> تطبيق القالب في المتجر</>}</Button><Button asChild type="button" variant="outline"><Link href="/merchant/product-taxonomy">مراجعة الأصناف والخصائص أولاً</Link></Button></div>
  </div>;
}

function PreviewBlock({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <section className="rounded-2xl border bg-white p-4 shadow-sm"><h4 className="mb-3 flex items-center gap-2 font-black text-slate-950">{icon}{title}</h4>{children}</section>;
}
