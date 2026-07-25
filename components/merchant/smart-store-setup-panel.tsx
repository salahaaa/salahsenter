"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Palette, RefreshCcw, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HelpCard } from "@/components/ui/help-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Plan = any;

export function SmartStoreSetupPanel({ store }: { store: { name: string; slug: string } }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setLoading(true);
    setMessage("جارٍ توليد تصميم ذكي للمتجر...");
    const response = await fetch("/api/merchant/smart-store-setup/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activity: data.get("activity"),
        storeName: data.get("storeName") || store.name,
        style: data.get("style"),
        description: data.get("description") || undefined,
        primaryColor: data.get("primaryColor"),
        accentColor: data.get("accentColor"),
        includeCategories: data.get("includeCategories") === "on",
        includeProducts: data.get("includeProducts") === "on",
        includeBanners: data.get("includeBanners") === "on",
        includeAttributes: data.get("includeAttributes") === "on"
      })
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر التوليد");
    setPlan(json.data.plan);
    setMessage("✓ تم توليد الخطة. راجع المعاينة ثم اضغط تطبيق.");
  }

  async function apply() {
    if (!plan) return;
    if (!window.confirm("سيتم إنشاء أقسام وبانرات ومنتجات تجريبية قابلة للتعديل. هل تريد التطبيق؟")) return;
    setLoading(true);
    const response = await fetch("/api/merchant/smart-store-setup/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? "✓ تم تطبيق الإعداد الذكي. يمكنك تعديل كل العناصر من الشاشات التقليدية." : json.message || "تعذر التطبيق");
  }

  return (
    <div className="space-y-6">
      <HelpCard title="متى أستخدم الإعداد الذكي؟">
        <p><b>الإعداد التقليدي:</b> إذا كنت تريد التحكم بكل عنصر يدوياً من البداية.</p>
        <p><b>الإعداد الذكي:</b> إذا أردت إنشاء متجر شبه جاهز بسرعة ثم تعدّل الأقسام والمنتجات والبانرات لاحقاً.</p>
        <p>كل ما ينشئه النظام قابل للتعديل والحذف وإعادة التوليد.</p>
      </HelpCard>

      <form onSubmit={generate} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2">
        <Field label="اسم المتجر" name="storeName" defaultValue={store.name} />
        <Field label="نوع النشاط" name="activity" required placeholder="مطعم / سوبر ماركت / إلكترونيات / ملابس / أدوات منزلية" />
        <div className="space-y-2"><Label>نمط المتجر</Label><select name="style" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="modern">حديث</option><option value="luxury">فاخر</option><option value="dark">داكن</option><option value="soft">هادئ</option><option value="youth">شبابي</option><option value="classic">كلاسيكي</option></select></div>
        <div className="grid grid-cols-2 gap-3"><Field label="اللون الأساسي" name="primaryColor" type="color" defaultValue="#2563eb" /><Field label="لون مساعد" name="accentColor" type="color" defaultValue="#f59e0b" /></div>
        <div className="space-y-2 md:col-span-2"><Label>وصف مختصر لما تريد</Label><Textarea name="description" placeholder="مثال: أريد مطعماً للمشويات والوجبات العائلية بتصميم فاخر وألوان دافئة" /></div>
        <div className="grid gap-2 md:col-span-2 sm:grid-cols-4"><Check name="includeCategories" label="الأقسام" /><Check name="includeProducts" label="منتجات تجريبية" /><Check name="includeBanners" label="بانرات" /><Check name="includeAttributes" label="خصائص" /></div>
        <Button disabled={loading} className="md:col-span-2"><Sparkles className="h-4 w-4" /> {loading ? "جارٍ التوليد..." : "توليد الإعداد الذكي"}</Button>
      </form>

      {plan ? <PlanPreview plan={plan} onApply={apply} loading={loading} storeSlug={store.slug} /> : null}
      {message ? <p className="rounded-2xl border bg-white p-4 text-sm font-bold text-slate-700 shadow-card">{message}</p> : null}
    </div>
  );
}

function PlanPreview({ plan, onApply, loading, storeSlug }: { plan: Plan; onApply: () => void; loading: boolean; storeSlug: string }) {
  return (
    <section className="overflow-hidden rounded-[2rem] border bg-white shadow-card">
      <div className="p-6" style={{ background: `linear-gradient(135deg, ${plan.theme.primaryColor}, ${plan.theme.accentColor})`, color: "white" }}>
        <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 inline-flex rounded-full bg-white/15 px-4 py-2 text-xs font-black">Preview مباشر</p><h2 className="text-3xl font-black">{plan.input.storeName}</h2><p className="mt-2 text-white/75">{plan.theme.mood} • {plan.input.activity}</p></div><Palette className="h-12 w-12 opacity-80" /></div>
      </div>
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <div><h3 className="mb-3 font-black">الألوان والثيم</h3><div className="flex gap-2"><span className="h-12 w-12 rounded-2xl border" style={{ backgroundColor: plan.theme.primaryColor }} /><span className="h-12 w-12 rounded-2xl border" style={{ backgroundColor: plan.theme.accentColor }} /><span className="h-12 w-12 rounded-2xl border" style={{ backgroundColor: plan.theme.backgroundColor }} /></div></div>
        <div><h3 className="mb-3 font-black">الأقسام المقترحة</h3><div className="flex flex-wrap gap-2">{plan.categories.map((category: any) => <span key={category.slug} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold">{category.name}</span>)}</div></div>
        <div className="lg:col-span-2"><h3 className="mb-3 font-black">البانرات</h3><div className="grid gap-3 md:grid-cols-2">{plan.banners.map((banner: any) => <img key={banner.title} src={banner.imageUrl} alt={banner.title} className="h-40 w-full rounded-2xl object-cover" />)}</div></div>
        <div className="lg:col-span-2"><h3 className="mb-3 font-black">منتجات تجريبية قابلة للتعديل</h3><div className="grid gap-3 md:grid-cols-4">{plan.demoProducts.map((product: any) => <article key={product.name} className="rounded-2xl border bg-slate-50 p-3"><img src={product.imageUrl} alt={product.name} className="h-24 w-full rounded-xl object-cover" /><p className="mt-2 font-black">{product.name}</p><p className="text-sm text-slate-500">{product.price}</p></article>)}</div></div>
      </div>
      <div className="flex flex-wrap gap-3 border-t bg-slate-50 p-5"><Button onClick={onApply} disabled={loading}><Save className="h-4 w-4" /> تطبيق الإعداد الذكي</Button><Button asChild variant="outline"><Link href={`/store/${storeSlug}?preview=1`} target="_blank">معاينة المتجر</Link></Button><Button type="button" variant="outline" onClick={() => window.location.reload()}><RefreshCcw className="h-4 w-4" /> إعادة البدء</Button></div>
    </section>
  );
}

function Field({ label, name, type = "text", defaultValue = "", required = false, placeholder = "" }: { label: string; name: string; type?: string; defaultValue?: string; required?: boolean; placeholder?: string }) { return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} defaultValue={defaultValue} required={required} placeholder={placeholder} /></div>; }
function Check({ name, label }: { name: string; label: string }) { return <label className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold"><input name={name} type="checkbox" defaultChecked /> {label}</label>; }
