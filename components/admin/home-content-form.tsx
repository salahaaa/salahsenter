"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";
import type { HomeContentSettings } from "@/lib/home-content";
import { ExperiencePreviewButton } from "@/components/admin/experience/experience-preview-button";

const groups: Array<{ title: string; fields: Array<keyof HomeContentSettings>; textarea?: Array<keyof HomeContentSettings> }> = [
  { title: "نصوص الهيدر والبحث", fields: ["searchPlaceholder", "loginLabel", "openStoreLabel", "newsLabel"] },
  { title: "Hero Section", fields: ["heroBadge", "heroTitle", "heroBackgroundImage", "heroWingsLabel", "heroStoresLabel", "heroAvailabilityLabel"], textarea: ["heroSubtitle"] },
  { title: "بانر العروض والأزرار", fields: ["promoPrimaryButton", "promoSecondaryButton"] },
  { title: "عناوين الأقسام", fields: ["featuredStoresKicker", "featuredStoresDescription", "wingsKicker", "wingsDescription", "wingsAllButton", "productsKicker", "latestTitle", "latestHighlight"] },
  { title: "دعوة فتح متجر", fields: ["merchantCtaBadge", "merchantCtaTitle", "merchantCtaButton"], textarea: ["merchantCtaDescription"] },
  { title: "الفوتر وبيانات التواصل", fields: ["footerText", "contactPhone", "contactEmail", "whatsappUrl", "facebookUrl", "instagramUrl"] }
];

const labels: Record<keyof HomeContentSettings, string> = {
  platformName: "اسم المنصة في الهيدر",
  platformSubtitle: "النص الفرعي تحت الاسم",
  logoLetter: "حرف/رمز الشعار",
  searchPlaceholder: "نص حقل البحث",
  loginLabel: "نص زر الدخول",
  openStoreLabel: "نص زر فتح متجر",
  newsLabel: "عنوان شريط الأخبار",
  heroBadge: "شارة الهيرو",
  heroTitle: "عنوان الهيرو الرئيسي",
  heroSubtitle: "وصف الهيرو",
  heroBackgroundImage: "رابط صورة خلفية الهيرو",
  heroWingsLabel: "تسمية إحصائية الأجنحة",
  heroStoresLabel: "تسمية إحصائية المتاجر",
  heroAvailabilityLabel: "تسمية 24/7",
  promoPrimaryButton: "زر البانر الأساسي",
  promoSecondaryButton: "زر البانر الثانوي",
  featuredStoresKicker: "النص الصغير للمتاجر المميزة",
  featuredStoresDescription: "وصف المتاجر المميزة",
  wingsKicker: "النص الصغير للأجنحة",
  wingsDescription: "وصف الأجنحة",
  wingsAllButton: "زر كل الأجنحة",
  productsKicker: "النص الصغير للمنتجات",
  latestTitle: "عنوان أحدث الإضافات",
  latestHighlight: "النص الملون في أحدث الإضافات",
  merchantCtaBadge: "شارة دعوة فتح متجر",
  merchantCtaTitle: "عنوان دعوة فتح متجر",
  merchantCtaDescription: "وصف دعوة فتح متجر",
  merchantCtaButton: "زر دعوة فتح متجر",
  footerText: "نص الفوتر",
  contactPhone: "رقم التواصل",
  contactEmail: "البريد الرسمي",
  whatsappUrl: "رابط واتساب",
  facebookUrl: "رابط فيسبوك",
  instagramUrl: "رابط إنستغرام"
};

export function HomeContentForm({ initial }: { initial: HomeContentSettings }) {
  const [values, setValues] = useState<HomeContentSettings>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof HomeContentSettings>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/admin/home-content", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? "✓ تم حفظ كل نصوص وصور الواجهة الرئيسية" : json.message || "تعذر الحفظ");
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {groups.map((group) => (
        <section key={group.title} className="rounded-3xl border bg-white p-6 shadow-card">
          <h2 className="mb-5 text-xl font-black text-slate-950">{group.title}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {group.fields.map((field) => (
              field === "heroBackgroundImage" ? (
                <MediaUrlInput key={field} label={labels[field]} name={field} value={values[field] || ""} onValueChange={(value) => set(field, value)} folder="admin/home/hero" accept="image/*" />
              ) : (
                <div key={field} className="space-y-2">
                  <Label>{labels[field]}</Label>
                  <Input value={values[field] || ""} onChange={(event) => set(field, event.target.value)} />
                </div>
              )
            ))}
            {group.textarea?.map((field) => (
              <div key={field} className="space-y-2 md:col-span-2">
                <Label>{labels[field]}</Label>
                <Textarea value={values[field] || ""} onChange={(event) => set(field, event.target.value)} />
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border bg-white/95 p-4 shadow-soft backdrop-blur">
        <ExperiencePreviewButton scope="home_content" payload={values}/>
        <Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "نشر محتوى الواجهة"}</Button>
        {message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}
      </div>
    </form>
  );
}
