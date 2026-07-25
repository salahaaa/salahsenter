"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";

type Product = { id: string; name: string };
type BannerSuggestion = {
  campaignName: string;
  headline: string;
  description: string;
  cta: string;
  keywords: string[];
  linkHint: string;
  colorPalette: { name: string; background: string; accent: string; text: string };
  layout: string;
  visualBrief: string;
  imageGenerationPrompt: string;
  creativeConcepts: Array<{
    id: "product_hero" | "offer_focus" | "trust_story";
    name: string;
    rationale: string;
    headline: string;
    cta: string;
    layout: string;
    visualPrompt: string;
    mobileSafeArea: string;
    colorPalette: { name: string; background: string; accent: string; text: string };
  }>;
  reviewChecklist: string[];
};

export function AdCampaignForm({ products, storeId }: { products: Product[]; storeId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("sponsored_products");
  const [imageUrl, setImageUrl] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<BannerSuggestion | null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState<BannerSuggestion["creativeConcepts"][number]["id"] | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  async function prepareBannerSuggestion() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const productIds = data.getAll("productIds").map(String).filter(Boolean);
    setAiLoading(true);
    setAiMessage(null);
    const response = await fetch("/api/merchant/ad-campaigns/ai-banner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignType: type,
        productIds,
        objective: data.get("aiObjective") || "زيادة الزيارات والمبيعات",
        offerText: data.get("aiOfferText") || "",
        audience: data.get("aiAudience") || "",
        tone: data.get("aiTone") || undefined
      })
    });
    const json = await response.json().catch(() => ({}));
    setAiLoading(false);
    if (!response.ok) {
      setAiMessage(json.message || "تعذر تجهيز البنر");
      return;
    }
    const suggestion = json.data?.suggestion as BannerSuggestion;
    setAiSuggestion(suggestion);
    setSelectedConceptId(suggestion.creativeConcepts?.[0]?.id || null);
    const elements = form.elements as typeof form.elements & Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined>;
    if (elements.name) elements.name.value = suggestion.campaignName;
    if (elements.headline) elements.headline.value = suggestion.headline;
    if (elements.description) elements.description.value = suggestion.description;
    if (elements.keywords) elements.keywords.value = suggestion.keywords.join(", ");
    if (elements.linkUrl && !elements.linkUrl.value) elements.linkUrl.value = suggestion.linkHint;
    setAiMessage("✓ تم تجهيز نصوص البنر والحملة. اختر فكرة تصميم، راجعها، ثم ارفع الصورة النهائية.");
  }

  function applyCreativeConcept(concept: BannerSuggestion["creativeConcepts"][number]) {
    const form = formRef.current;
    if (!form) return;
    const elements = form.elements as typeof form.elements & Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined>;
    if (elements.headline) elements.headline.value = concept.headline;
    if (elements.description) elements.description.value = `${concept.rationale} ${concept.mobileSafeArea}`;
    setSelectedConceptId(concept.id);
    setAiMessage(`✓ تم تطبيق تكوين «${concept.name}». استخدم prompt أو ارفعه إلى مصممك/مولد الصور ثم راجع الصورة النهائية.`);
  }

  async function copyCreativePrompt(prompt: string) {
    try {
      await navigator.clipboard.writeText(prompt);
      setAiMessage("✓ تم نسخ prompt التصميم. يمكنك استخدامه لدى مصمم أو مولد صور معتمد ثم رفع النتيجة.");
    } catch {
      setAiMessage("تعذر نسخ prompt تلقائيًا؛ انسخه يدويًا من بطاقة التصميم.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const productIds = data.getAll("productIds").map(String).filter(Boolean);
    setLoading(true);
    const selectedConcept = aiSuggestion?.creativeConcepts.find((concept) => concept.id === selectedConceptId);
    const creative: Record<string, unknown> = {
      headline: data.get("headline"),
      description: data.get("description"),
      aiDesign: selectedConcept ? {
        conceptId: selectedConcept.id,
        conceptName: selectedConcept.name,
        visualPrompt: selectedConcept.visualPrompt,
        layout: selectedConcept.layout,
        mobileSafeArea: selectedConcept.mobileSafeArea,
        palette: selectedConcept.colorPalette
      } : undefined
    };
    // For banner-type campaigns the merchant uploads a creative image + destination link.
    if (type === "homepage_banner" || type === "category_banner") {
      creative.imageUrl = imageUrl;
      creative.linkUrl = data.get("linkUrl") || "";
      const alternateHeadline = String(data.get("alternateHeadline") || "").trim();
      const alternateDescription = String(data.get("alternateDescription") || "").trim();
      if (alternateHeadline || alternateDescription) {
        creative.variants = [{ label: "B", headline: alternateHeadline || data.get("headline") || "", description: alternateDescription || data.get("description") || "", imageUrl, linkUrl: data.get("linkUrl") || "" }];
      }
    }
    const response = await fetch("/api/merchant/ad-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        type,
        placementId: data.get("placementId") || undefined,
        billingModel: data.get("billingModel") || "cpc",
        frequencyCap: Number(data.get("frequencyCap") || 3),
        budget: Number(data.get("budget") || 0),
        dailyBudget: Number(data.get("dailyBudget") || 0),
        bidAmount: Number(data.get("bidAmount") || 0),
        startsAt: data.get("startsAt") ? new Date(String(data.get("startsAt"))).toISOString() : null,
        endsAt: data.get("endsAt") ? new Date(String(data.get("endsAt"))).toISOString() : null,
        productIds,
        targetConfig: { keywords: String(data.get("keywords") || "").split(/,|\n/).map((x) => x.trim()).filter(Boolean) },
        creative
      })
    });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? "✓ تم إرسال الحملة للمراجعة. ستظهر في الواجهة الرئيسية بعد اعتماد الإدارة." : json.message || "تعذر إنشاء الحملة");
    if (response.ok) { form.reset(); setImageUrl(""); router.refresh(); }
  }

  const isBanner = type === "homepage_banner" || type === "category_banner";
  const placementOptions = type === "homepage_banner"
    ? [["homepage_marketplace_ads", "بنر إعلان المول الرئيسي"]]
    : type === "category_banner"
      ? [["category_listing", "قائمة القسم"]]
      : type === "featured_products"
        ? [["homepage_featured_products", "منتجات مميزة في الواجهة"], ["homepage_sponsored_products", "منتجات ممولة في الواجهة"], ["search_results", "نتائج البحث"], ["category_listing", "قائمة القسم"], ["storefront", "واجهة المتجر"]]
        : [["homepage_sponsored_products", "منتجات ممولة في الواجهة"], ["search_results", "نتائج البحث"], ["category_listing", "قائمة القسم"], ["storefront", "واجهة المتجر"]];

  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2">
      <section className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 md:col-span-2">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">AI Banner Assistant</div>
            <h2 className="text-xl font-black text-slate-950">تجهيز بنر إعلان وحملة ذكية</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">يجهز اسم الحملة، العنوان، الوصف، الكلمات المفتاحية، فكرة التصميم، وقائمة مراجعة قبل الإرسال. لا يحفظ صور base64 داخل قاعدة البيانات.</p>
          </div>
          <Button type="button" onClick={prepareBannerSuggestion} disabled={aiLoading}>{aiLoading ? "جارٍ التجهيز..." : "جهّز الإعلان بالذكاء"}</Button>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="هدف الحملة" name="aiObjective" placeholder="مثال: زيادة مبيعات منتج جديد" />
          <Field label="نص العرض" name="aiOfferText" placeholder="مثال: خصم 30%" />
          <Field label="الجمهور المستهدف" name="aiAudience" placeholder="مثال: العائلات / الشباب" />
          <div className="space-y-2"><Label>أسلوب التصميم</Label><select name="aiTone" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="premium">فاخر</option><option value="urgent">عاجل/خصم</option><option value="friendly">ودّي</option><option value="seasonal">موسمي</option></select></div>
        </div>
        {aiMessage ? <p className="mt-3 rounded-2xl bg-white p-3 text-sm font-bold text-slate-700">{aiMessage}</p> : null}
        {aiSuggestion ? <div className="mt-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border bg-white p-4">
              <p className="mb-2 text-sm font-black text-slate-950">معاينة الاتجاه الأساسي</p>
              <div className="rounded-2xl p-5" style={{ background: aiSuggestion.colorPalette.background, color: aiSuggestion.colorPalette.text }}>
                <p className="text-xs font-bold opacity-80">{aiSuggestion.colorPalette.name}</p>
                <h3 className="mt-2 text-2xl font-black">{aiSuggestion.headline}</h3>
                <p className="mt-2 text-sm leading-6 opacity-90">{aiSuggestion.description}</p>
                <span className="mt-4 inline-flex rounded-full px-4 py-2 text-sm font-black" style={{ background: aiSuggestion.colorPalette.accent, color: aiSuggestion.colorPalette.background }}>{aiSuggestion.cta}</span>
              </div>
              <p className="mt-3 text-xs font-bold leading-6 text-slate-500">{aiSuggestion.visualBrief}</p>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <p className="mb-2 text-sm font-black text-slate-950">قائمة مراجعة قبل الإرسال</p>
              <ul className="space-y-2 text-xs font-bold leading-6 text-slate-600">{aiSuggestion.reviewChecklist.map((item) => <li key={item}>• {item}</li>)}</ul>
              <Button type="button" size="sm" variant="outline" className="mt-4" onClick={() => copyCreativePrompt(aiSuggestion.imageGenerationPrompt)}>نسخ prompt التصميم</Button>
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-4">
            <div className="mb-3"><p className="font-black text-slate-950">3 تكوينات تصميمية مقترحة بالذكاء</p><p className="mt-1 text-xs leading-6 text-slate-500">اختر تكوينًا لتطبيق النص والاتجاه التصميمي. الصورة النهائية تبقى تحت مراجعتك ويجب رفعها من مصدر موثوق.</p></div>
            <div className="grid gap-3 lg:grid-cols-3">{aiSuggestion.creativeConcepts.map((concept) => <article key={concept.id} className={`rounded-2xl border p-4 ${selectedConceptId === concept.id ? "border-primary ring-2 ring-primary/20" : "bg-slate-50"}`}>
              <div className="rounded-xl p-3" style={{ background: concept.colorPalette.background, color: concept.colorPalette.text }}><p className="text-xs font-bold opacity-80">{concept.colorPalette.name}</p><h4 className="mt-1 font-black">{concept.headline}</h4><span className="mt-3 inline-flex rounded-lg px-3 py-1 text-xs font-black" style={{ background: concept.colorPalette.accent, color: concept.colorPalette.background }}>{concept.cta}</span></div>
              <p className="mt-3 text-sm font-black text-slate-900">{concept.name}</p><p className="mt-1 text-xs leading-6 text-slate-600">{concept.rationale}</p><p className="mt-2 text-xs leading-6 text-slate-500">{concept.mobileSafeArea}</p>
              <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" onClick={() => applyCreativeConcept(concept)}>تطبيق التكوين</Button><Button type="button" size="sm" variant="outline" onClick={() => copyCreativePrompt(concept.visualPrompt)}>نسخ prompt</Button></div>
            </article>)}</div>
          </div>
        </div> : null}
      </section>
      <Field label="اسم الحملة" name="name" required />
      <div className="space-y-2">
        <Label>نوع الإعلان</Label>
        <select name="type" value={type} onChange={(e) => setType(e.target.value)} className="h-11 w-full rounded-xl border bg-white px-4 text-sm">
          <option value="sponsored_products">منتجات ممولة (Sponsored Products)</option>
          <option value="featured_products">منتجات مميزة (Featured Products)</option>
          <option value="homepage_banner">بنر الواجهة الرئيسية (Homepage Banner)</option>
        </select>
        {isBanner ? <p className="text-xs font-bold text-amber-700">يعرض بنرك كإعلان مموّل في الصفحة الرئيسية بعد اعتماد الإدارة. ارفع صورة بنر احترافية وأدخل رابط الوجهة.</p> : null}
      </div>

      {/* Banner creative — image + link — only for banner types */}
      {isBanner ? (
        <>
          <div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
            <p className="mb-3 text-sm font-black text-amber-800">محتوى البنر الإعلاني</p>
            <div className="grid gap-4 md:grid-cols-2">
              <MediaUrlInput label="صورة البنر: رابط أو رفع" name="imageUrl" value={imageUrl} onValueChange={setImageUrl} storeId={storeId} folder={`stores/${storeId}/ads`} accept="image/*" />
              <Field label="رابط الوجهة (عند الضغط على البنر)" name="linkUrl" placeholder="/store/... أو https://..." />
            </div>
            <p className="mt-3 text-xs font-bold text-slate-500">الصورة المثالية للبنر: أفقية، دقة عالية (مثلاً 1200×400)، صيغة JPG/PNG/WebP.</p>
            <div className="mt-4 rounded-2xl border border-blue-100 bg-white p-4"><p className="font-black text-slate-900">اختبار A/B اختياري</p><p className="mt-1 text-xs leading-6 text-slate-500">أضف نسخة B مختلفة في العنوان أو الوصف. يوزعها المتصفح بثبات على Cohort مجهول، ويُسجل معرف النسخة فقط مع أحداث الإعلان دون تخزين معرف الزائر الخام.</p><div className="mt-3 grid gap-3 md:grid-cols-2"><Field label="عنوان النسخة B" name="alternateHeadline" /><div className="space-y-2"><Label>وصف النسخة B</Label><Textarea name="alternateDescription" /></div></div></div>
          </div>
        </>
      ) : null}

      <div className="space-y-2"><Label>موضع العرض</Label><select key={type} name="placementId" defaultValue={placementOptions[0][0]} className="h-11 w-full rounded-xl border bg-white px-4 text-sm">{placementOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><p className="text-xs font-bold text-slate-500">لن يظهر الإعلان إلا داخل الموضع المحدد وبوسم إعلان ممول.</p></div>
      <div className="space-y-2"><Label>نموذج التسعير</Label><select name="billingModel" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="cpc">CPC — لكل نقرة نظيفة</option><option value="cpm">CPM — لكل ألف ظهور</option></select><p className="text-xs font-bold text-slate-500">CPM يتطلب سعراً لا يقل عن 10 ريال للألف ظهور عند تفعيل السعر.</p></div>
      <Field label="الميزانية الكلية" name="budget" type="number" required />
      <Field label="ميزانية يومية" name="dailyBudget" type="number" />
      <Field label="سعر CPC أو CPM" name="bidAmount" type="number" />
      <Field label="حد الظهور اليومي للزائر (1–20)" name="frequencyCap" type="number" />
      <Field label="تاريخ البداية" name="startsAt" type="datetime-local" />
      <Field label="عنوان الإعلان" name="headline" />
      <Field label="تاريخ النهاية" name="endsAt" type="datetime-local" />
      <div className="space-y-2 md:col-span-2"><Label>المنتجات المرتبطة (اختياري)</Label><select name="productIds" multiple className="min-h-40 w-full rounded-xl border bg-white px-4 py-3 text-sm">{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div>
      <div className="space-y-2"><Label>كلمات الاستهداف</Label><Textarea name="keywords" /></div>
      <div className="space-y-2"><Label>وصف الإعلان</Label><Textarea name="description" /></div>
      <div className="flex items-center gap-3 md:col-span-2"><Button disabled={loading}>{loading ? "جارٍ الإرسال..." : "إرسال للمراجعة"}</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
    </form>
  );
}

function Field({ label, name, type = "text", required = false, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) { return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} required={required} placeholder={placeholder} /></div>; }
