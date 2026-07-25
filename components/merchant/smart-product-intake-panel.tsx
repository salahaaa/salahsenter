"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { Barcode, FileSpreadsheet, ImageIcon, Loader2, Mic, Save, Sparkles, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpCard } from "@/components/ui/help-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";
import { AiImportRepairPanel } from "@/components/merchant/ai-import-repair-panel";

type Category = { id: string; name: string; level: number; code: string | null };
type DuplicateCandidate = { id: string; name: string; slug: string; score: number; reason: string; mainImageUrl?: string | null };

type DraftVariant = {
  title: string;
  sku?: string;
  barcode?: string;
  price?: number;
  stockQuantity?: number;
  lowStockThreshold?: number;
  imageUrl?: string;
  images?: string[];
  attributes: Record<string, string>;
};

type Draft = {
  name: string;
  categoryId?: string | null;
  categoryName?: string;
  brand?: string;
  barcode?: string;
  basePrice?: number;
  stockQuantity?: number;
  lowStockThreshold?: number;
  mainImageUrl?: string;
  shortDescription?: string;
  description?: string;
  keywords?: string[];
  tags?: string[];
  attributes?: Record<string, string>;
  variants?: DraftVariant[];
  confidenceScore?: number;
  classificationMode?: "auto" | "suggested" | "needs_review";
  duplicateCandidates?: DuplicateCandidate[];
  status?: "draft" | "active" | "inactive" | "archived";
  errors?: string[];
  sourceRow?: number;
};

export function SmartProductIntakePanel({ categories }: { categories: Category[] }) {
  const [active, setActive] = useState<"voice" | "file" | "barcode" | "image">("voice");
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sourceFileName, setSourceFileName] = useState("");
  const [lastImportRunId, setLastImportRunId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [barcodeValue, setBarcodeValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function parseText(input = text) {
    if (!input.trim()) return setMessage("اكتب أو سجّل وصفاً للمنتج أولاً");
    setLoading(true);
    const response = await fetch("/api/merchant/product-intake/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: input }) });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر التحليل");
    setDraft(json.data.draft);
    setMessage("✓ تم تحليل الوصف وتعبئة مسودة المنتج");
  }

  function startVoice() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return setMessage("المتصفح لا يدعم الإدخال الصوتي. استخدم Chrome أو Edge.");
    const recognition = new SpeechRecognition();
    recognition.lang = "ar";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); setMessage("تعذر التقاط الصوت"); };
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setText(transcript);
      parseText(transcript);
    };
    recognition.start();
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setSourceFileName(file.name);
    setLoading(true);
    setMessage("جارٍ قراءة الملف وتجهيز المعاينة...");
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/merchant/product-intake/import-file", { method: "POST", body: form });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر قراءة الملف");
    setDrafts(json.data.drafts || []);
    setMessage(`✓ تمت قراءة ${json.data.totalRows} صف. راجع المعاينة ثم احفظ.`);
  }

  async function lookupBarcode(input = barcodeValue) {
    if (!input.trim()) return setMessage("أدخل أو امسح الباركود أولاً");
    setLoading(true);
    const response = await fetch("/api/merchant/product-intake/barcode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ barcode: input }) });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر قراءة الباركود");
    if (json.data.existing) setMessage("تم العثور على منتج بنفس الباركود. يمكنك مراجعته من قائمة المنتجات.");
    setDraft(json.data.draft || { name: json.data.existing?.name || `منتج ${input}`, barcode: input });
  }

  async function scanBarcodeFromCamera() {
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) return setMessage("المتصفح لا يدعم BarcodeDetector. يمكنك إدخال الباركود يدوياً.");
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    await video.play();
    const detector = new Detector({ formats: ["ean_13", "ean_8", "code_128", "qr_code"] });
    setMessage("وجّه الكاميرا نحو الباركود...");
    const timer = window.setInterval(async () => {
      const codes = await detector.detect(video).catch(() => []);
      if (codes.length) {
        window.clearInterval(timer);
        stream.getTracks().forEach((track) => track.stop());
        const code = codes[0].rawValue;
        setBarcodeValue(code);
        lookupBarcode(code);
      }
    }, 600);
    window.setTimeout(() => {
      window.clearInterval(timer);
      stream.getTracks().forEach((track) => track.stop());
    }, 15000);
  }

  async function analyzeImage() {
    if (!imageUrl) return setMessage("ارفع صورة المنتج أولاً");
    setLoading(true);
    const response = await fetch("/api/merchant/product-intake/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl, hint: text }) });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر تحليل الصورة");
    setDraft(json.data.draft);
    setMessage("✓ تم تعبئة مسودة المنتج. راجع البيانات ثم احفظ.");
  }

  async function saveDraft(currentDraft: Draft | null = draft, mode: "create" | "update" = "create", status: "draft" | "active" = "draft") {
    if (!currentDraft?.name) return setMessage("لا توجد مسودة صالحة للحفظ");
    setLoading(true);
    const response = await fetch("/api/merchant/product-intake/bulk-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ drafts: [{ ...currentDraft, status }], mode }) });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر الحفظ");
    setMessage("✓ تم حفظ المنتج كمسودة. يمكنك تعديل التفاصيل من قائمة المنتجات.");
  }

  async function saveAll(mode: "create" | "update", status: "draft" | "active" = "draft") {
    const valid = drafts.filter((row) => row.name && !row.errors?.length).map((row) => ({ ...row, status }));
    if (!valid.length) return setMessage("لا توجد صفوف صالحة للحفظ");
    setLoading(true);
    const response = await fetch("/api/merchant/product-intake/bulk-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ drafts: valid, mode, sourceFileName: sourceFileName || null }) });
    const json = await response.json();
    setLoading(false);
    if (response.ok && json.data?.run?.id) setLastImportRunId(json.data.run.id);
    setMessage(response.ok ? `✓ تم الحفظ: ${json.data.created} ناجح / ${json.data.failed} فشل` : json.message || "تعذر الاستيراد");
  }

  async function rollbackLastImport() {
    if (!lastImportRunId || !window.confirm("سيتم أرشفة المنتجات التي أنشأتها هذه الدفعة فقط. هل تريد المتابعة؟")) return;
    setLoading(true);
    const response = await fetch(`/api/merchant/product-import-runs/${lastImportRunId}/rollback`, { method: "POST" });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? `✓ ${json.data?.message || "تم rollback الدفعة"}` : json.message || "تعذر rollback الدفعة");
    if (response.ok) setLastImportRunId(null);
  }

  return (
    <div className="space-y-6">
      <HelpCard title="كيف تستخدم الإدخال الذكي؟">
        <p><b>الصوت:</b> تحدث باسم المنتج ومواصفاته وسيتم توليد مسودة تلقائياً.</p>
        <p><b>Excel/CSV:</b> ارفع ملفاً يحتوي أعمدة مثل name, price, barcode, image, stock وستظهر معاينة قبل الحفظ.</p>
        <p><b>الباركود:</b> امسح بالكاميرا أو اكتب الرقم، ثم راجع المسودة.</p>
        <p><b>الصورة:</b> ارفع صورة وسيتم اقتراح اسم ووصف وتصنيف مبدئي للمراجعة.</p>
        <p><b>الثقة والتكرار:</b> كل مسودة تعرض نسبة ثقة واكتشاف تكرار ذكي؛ إذا ظهر منتج مشابه يمكنك تحديث الموجود بدلاً من إنشاء نسخة مكررة.</p>
      </HelpCard>

      <div className="grid gap-3 md:grid-cols-4">
        <Tab id="voice" active={active} setActive={setActive} icon={<Mic className="h-5 w-5" />} label="بالصوت" />
        <Tab id="file" active={active} setActive={setActive} icon={<FileSpreadsheet className="h-5 w-5" />} label="Excel / CSV" />
        <Tab id="barcode" active={active} setActive={setActive} icon={<Barcode className="h-5 w-5" />} label="باركود" />
        <Tab id="image" active={active} setActive={setActive} icon={<ImageIcon className="h-5 w-5" />} label="صورة AI" />
      </div>

      <section className="rounded-3xl border bg-white p-6 shadow-card">
        {active === "voice" ? <div className="grid gap-4 lg:grid-cols-[1fr_auto]"><div className="space-y-2"><Label>النص الصوتي أو الوصف</Label><Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب اسم المنتج ومواصفاته وسعره إن وجد، مثل: اسم المنتج، المقاس، اللون، السعر، المخزون" className="min-h-32" /></div><div className="flex flex-col gap-2 lg:w-52"><Button type="button" onClick={startVoice} disabled={listening || loading}><Mic className="h-4 w-4" /> {listening ? "يستمع..." : "تحدث الآن"}</Button><Button type="button" variant="outline" onClick={() => parseText()} disabled={loading}><Sparkles className="h-4 w-4" /> تحليل النص</Button></div></div> : null}

        {active === "file" ? <div className="space-y-4"><div className="rounded-2xl border border-dashed bg-slate-50 p-6 text-center"><UploadCloud className="mx-auto mb-3 h-10 w-10 text-slate-400" /><p className="font-black text-slate-800">ارفع Excel أو CSV</p><p className="mt-1 text-sm text-slate-500">الأعمدة المدعومة: name, category, brand, barcode, price, stock, image, description</p><Button type="button" variant="outline" className="relative mt-4 overflow-hidden"><input type="file" accept=".csv,.xlsx,.xls" onChange={importFile} className="absolute inset-0 cursor-pointer opacity-0" />اختيار ملف</Button></div>{drafts.length ? <><AiImportRepairPanel drafts={drafts} /><ImportPreview drafts={drafts} categories={categories} onSave={saveAll} /></> : null}</div> : null}

        {active === "barcode" ? <div className="space-y-4"><div className="grid gap-3 md:grid-cols-[1fr_auto_auto]"><Input value={barcodeValue} onChange={(e) => setBarcodeValue(e.target.value)} placeholder="اكتب رقم الباركود" /><Button type="button" onClick={() => lookupBarcode()} disabled={loading}>بحث</Button><Button type="button" variant="outline" onClick={scanBarcodeFromCamera}>مسح بالكاميرا</Button></div><video ref={videoRef} className="max-h-72 w-full rounded-3xl bg-slate-100" muted playsInline /></div> : null}

        {active === "image" ? <div className="grid gap-4 md:grid-cols-2"><MediaUrlInput label="صورة المنتج" name="aiImage" value={imageUrl} onValueChange={setImageUrl} folder="merchant/product-intake/images" accept="image/*" /><div className="space-y-2"><Label>معلومة إضافية اختيارية</Label><Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب أي معلومة تساعد في التعرف على المنتج: الاسم، الاستخدام، المقاس، اللون، السعر" /></div><Button type="button" onClick={analyzeImage} disabled={loading} className="md:col-span-2"><ImageIcon className="h-4 w-4" /> تحليل الصورة وتعبئة المسودة</Button></div> : null}
      </section>

      {draft ? <DraftEditor draft={draft} setDraft={setDraft} categories={categories} onSave={(mode, status) => saveDraft(draft, mode, status)} loading={loading} /> : null}
      {message ? <p className="rounded-2xl border bg-white p-4 text-sm font-bold text-slate-700 shadow-card">{loading ? <Loader2 className="ml-2 inline h-4 w-4 animate-spin" /> : null}{message}</p> : null}
      {lastImportRunId ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">تم تسجيل دفعة الاستيراد ويمكن rollback آمن للمنتجات المنشأة فقط. <Button type="button" size="sm" variant="outline" disabled={loading} onClick={rollbackLastImport}>Rollback هذه الدفعة</Button></div> : null}
      <div className="text-center"><Button asChild variant="outline"><Link href="/merchant/products">فتح قائمة المنتجات والتعديل الكامل</Link></Button></div>
    </div>
  );
}

function Tab({ id, active, setActive, icon, label }: { id: "voice" | "file" | "barcode" | "image"; active: string; setActive: (id: any) => void; icon: React.ReactNode; label: string }) {
  return <button type="button" onClick={() => setActive(id)} className={`rounded-3xl border p-5 text-right font-black transition ${active === id ? "border-blue-200 bg-blue-50 text-blue-700 shadow-card" : "bg-white hover:bg-slate-50"}`}>{icon}<span className="mr-2">{label}</span></button>;
}

function DraftEditor({ draft, setDraft, categories, onSave, loading }: { draft: Draft; setDraft: (draft: Draft) => void; categories: Category[]; onSave: (mode: "create" | "update", status: "draft" | "active") => void; loading: boolean }) {
  function set<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft({ ...draft, [key]: value }); }
  function setPrice(value: string) {
    const basePrice = Number(value || 0);
    setDraft({ ...draft, basePrice, variants: (draft.variants || []).map((variant) => ({ ...variant, price: basePrice })) });
  }
  function setStock(value: string) {
    const stockQuantity = Number(value || 0);
    setDraft({ ...draft, stockQuantity, variants: (draft.variants || []).map((variant) => ({ ...variant, stockQuantity })) });
  }
  function updateOptionList(attribute: "المقاس" | "اللون", value: string) {
    const values = splitOptionList(value);
    const attributes = { ...(draft.attributes || {}) };
    if (attribute === "المقاس") {
      attributes["المقاس"] = values[0] || "";
      attributes["المقاسات المتاحة"] = values.join("، ");
    } else {
      attributes["اللون"] = values[0] || "";
      attributes["الألوان المتاحة"] = values.join("، ");
    }
    const sizes = splitOptionList(attributes["المقاسات المتاحة"] || attributes["المقاس"] || "");
    const colors = splitOptionList(attributes["الألوان المتاحة"] || attributes["اللون"] || "");
    setDraft({
      ...draft,
      attributes,
      variants: buildDraftVariants({
        productName: draft.name,
        sizes,
        colors,
        basePrice: draft.basePrice || 0,
        stockQuantity: draft.stockQuantity ?? 1,
        lowStockThreshold: draft.lowStockThreshold ?? 2,
        imageUrl: draft.mainImageUrl
      })
    });
  }
  const confidence = Number(draft.confidenceScore || 0);
  const modeLabel = draft.classificationMode === "auto" ? "تصنيف تلقائي" : draft.classificationMode === "suggested" ? "اقتراح يحتاج مراجعة" : "يحتاج مراجعة";
  const duplicates = draft.duplicateCandidates || [];
  const variants = draft.variants || [];

  return (
    <section className="rounded-3xl border bg-white p-6 shadow-card">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">مسودة المنتج الذكية</h2>
          <p className="mt-1 text-sm text-slate-500">راجع المسودة قبل حفظها. النظام لا ينشر المنتج مباشرة إلا إذا اخترت ذلك لاحقاً من محرر المنتج.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-black">
          <span className={`rounded-full px-3 py-1 ${confidence >= 75 ? "bg-emerald-100 text-emerald-700" : confidence >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>ثقة {confidence}%</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{modeLabel}</span>
        </div>
      </div>

      {duplicates.length ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-black text-amber-900">تنبيه تكرار ذكي</p>
          <p className="mt-1 text-sm leading-6 text-amber-800">وجدنا منتجات مشابهة. يمكنك حفظ المنتج كجديد أو تحديث المنتج الأقرب بدلاً من إنشاء نسخة مكررة.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {duplicates.map((item) => <div key={item.id} className="rounded-xl bg-white/80 p-3 text-sm"><b>{item.name}</b><p className="text-xs text-amber-700">{item.reason} — تشابه {item.score}%</p></div>)}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="اسم المنتج" value={draft.name} onChange={(v) => set("name", v)} />
        <div className="space-y-2"><Label>التصنيف</Label><select value={draft.categoryId || ""} onChange={(e) => set("categoryId", e.target.value || null)} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">اختر التصنيف</option>{categories.map((category) => <option key={category.id} value={category.id}>{"—".repeat(category.level)} {category.code || ""} {category.name}</option>)}</select></div>
        <Field label="الماركة" value={draft.brand || ""} onChange={(v) => set("brand", v)} />
        <Field label="الباركود" value={draft.barcode || ""} onChange={(v) => set("barcode", v)} />
        <Field label="السعر" type="number" value={String(draft.basePrice || "")} onChange={setPrice} />
        <Field label="المخزون لكل خيار" type="number" value={String(draft.stockQuantity ?? 1)} onChange={setStock} />
        <Field label="المقاسات المتاحة" value={draft.attributes?.["المقاسات المتاحة"] || draft.attributes?.["المقاس"] || ""} onChange={(v) => updateOptionList("المقاس", v)} />
        <Field label="الألوان المتاحة" value={draft.attributes?.["الألوان المتاحة"] || draft.attributes?.["اللون"] || ""} onChange={(v) => updateOptionList("اللون", v)} />
        <div className="md:col-span-3"><MediaUrlInput label="الصورة" name="draftImage" value={draft.mainImageUrl || ""} onValueChange={(v) => setDraft({ ...draft, mainImageUrl: v, variants: (draft.variants || []).map((variant) => ({ ...variant, imageUrl: v, images: v ? [v] : [] })) })} folder="merchant/product-intake/drafts" accept="image/*" /></div>
        <div className="space-y-2 md:col-span-3"><Label>الوصف</Label><Textarea value={draft.description || ""} onChange={(e) => set("description", e.target.value)} /></div>
        {variants.length ? <VariantPreview variants={variants} /> : null}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" onClick={() => onSave("create", "draft")} disabled={loading}><Save className="h-4 w-4" /> حفظ كمسودة</Button>
        <Button type="button" variant="secondary" onClick={() => onSave("create", "active")} disabled={loading}>نشر مباشرة</Button>
        {duplicates.length ? <Button type="button" variant="outline" onClick={() => onSave("update", draft.status === "active" ? "active" : "draft")} disabled={loading}>تحديث المنتج المشابه</Button> : null}
      </div>
    </section>
  );
}


function VariantPreview({ variants }: { variants: DraftVariant[] }) {
  return (
    <div className="md:col-span-3 rounded-2xl border bg-slate-50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-black text-slate-900">الخيارات المتولدة: {variants.length}</p>
        <p className="text-xs font-bold text-slate-500">ستظهر هذه المقاسات والألوان في صفحة المنتج للعميل.</p>
      </div>
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
        {variants.slice(0, 16).map((variant, index) => (
          <div key={`${variant.title}-${index}`} className="rounded-xl bg-white p-3 text-sm shadow-sm">
            <p className="font-black text-slate-950">{variant.title}</p>
            <p className="mt-1 text-xs text-slate-500">مخزون: {variant.stockQuantity ?? 0} — سعر: {variant.price ?? 0}</p>
          </div>
        ))}
      </div>
      {variants.length > 16 ? <p className="mt-2 text-xs font-bold text-slate-500">تم إخفاء باقي الخيارات في المعاينة فقط.</p> : null}
    </div>
  );
}

function splitOptionList(value: string) {
  return value.split(/،|,|\n|\/| و /).map((item) => item.trim()).filter(Boolean);
}

function buildDraftVariants({ productName, sizes, colors, basePrice, stockQuantity, lowStockThreshold, imageUrl }: { productName: string; sizes: string[]; colors: string[]; basePrice: number; stockQuantity: number; lowStockThreshold: number; imageUrl?: string }) {
  const sizeOptions = sizes.length ? sizes : [""];
  const colorOptions = colors.length ? colors : [""];
  const rows: DraftVariant[] = [];
  for (const size of sizeOptions) {
    for (const color of colorOptions) {
      const attributes: Record<string, string> = {};
      if (size) attributes["المقاس"] = size;
      if (color) attributes["اللون"] = color;
      const title = [size, color].filter(Boolean).join(" / ") || "افتراضي";
      rows.push({
        title,
        sku: `${productName}-${title}`.replace(/\s+/g, "-").slice(0, 80),
        price: basePrice,
        stockQuantity,
        lowStockThreshold,
        imageUrl,
        images: imageUrl ? [imageUrl] : [],
        attributes
      });
    }
  }
  return rows.slice(0, 80);
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={(e) => onChange(e.target.value)} /></div>; }

function ImportPreview({ drafts, categories, onSave }: { drafts: Draft[]; categories: Category[]; onSave: (mode: "create" | "update", status?: "draft" | "active") => void }) {
  return <div className="overflow-hidden rounded-3xl border"><div className="flex flex-wrap items-center justify-between gap-3 border-b bg-white p-4"><div><p className="font-black">معاينة الاستيراد</p><p className="text-sm text-slate-500">راجع أول 20 صف قبل الحفظ. الصفوف التي بها أخطاء لن تحفظ.</p></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={() => onSave("create", "draft")}>حفظ كمسودات</Button><Button type="button" variant="secondary" onClick={() => onSave("create", "active")}>نشر المنتجات الصالحة</Button><Button type="button" variant="outline" onClick={() => onSave("update", "draft")}>تحديث حسب الباركود/التشابه</Button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-right text-sm"><thead className="bg-slate-100"><tr><th className="p-3">الصف</th><th className="p-3">الاسم</th><th className="p-3">التصنيف المقترح</th><th className="p-3">الماركة</th><th className="p-3">السعر</th><th className="p-3">المخزون</th><th className="p-3">الحالة</th></tr></thead><tbody>{drafts.slice(0, 20).map((draft, index) => <tr key={index} className="border-t"><td className="p-3">{draft.sourceRow || index + 1}</td><td className="p-3 font-bold">{draft.name}</td><td className="p-3">{categories.find((category) => category.id === draft.categoryId)?.name || draft.categoryName || "-"}</td><td className="p-3">{draft.brand || "-"}</td><td className="p-3">{draft.basePrice || 0}</td><td className="p-3">{draft.stockQuantity || 0}</td><td className="p-3">{draft.errors?.length ? <span className="text-red-600">{draft.errors.join("، ")}</span> : <span className="text-emerald-600">جاهز</span>}</td></tr>)}</tbody></table></div></div>;
}
