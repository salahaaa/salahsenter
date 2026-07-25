"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StoreContact = {
  contactPhone: string | null;
  contactEmail: string | null;
  videoUrl: string | null;
  socialLinks: Record<string, string>;
};

export function StoreContactForm({ store }: { store: StoreContact }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/merchant/store-contact", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactPhone: data.get("contactPhone") || "",
        contactEmail: data.get("contactEmail") || "",
        whatsapp: data.get("whatsapp") || "",
        facebook: data.get("facebook") || "",
        instagram: data.get("instagram") || "",
        videoUrl: data.get("videoUrl") || ""
      })
    });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? "✓ تم تحديث بيانات التواصل" : json.message || "تعذر الحفظ");
    if (response.ok) router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2">
      <div className="md:col-span-2"><h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><Phone className="h-5 w-5 text-blue-600" /> بيانات التواصل التي تظهر للعملاء</h2><p className="mt-2 text-sm leading-7 text-slate-500">يمكنك تعديل الجوال والواتساب والروابط الاجتماعية. اسم المتجر والبريد المعتمد وبيانات العقد لا يمكن تغييرها مباشرة؛ تستخدم دورة طلب تعديل وملحق عقد موقع.</p></div>
      <Field label="رقم جوال التاجر / المتجر" name="contactPhone" defaultValue={store.contactPhone || ""} placeholder="+967..." />
      <div className="space-y-2"><Label>البريد الإلكتروني المعتمد للمتجر</Label><Input name="contactEmail" type="email" value={store.contactEmail || ""} readOnly className="bg-slate-100"/><p className="text-xs font-bold text-amber-700">لا يعدل من هنا لأنه جزء من هوية المتجر والعقد. <Link href="/merchant/identity-change-requests" className="underline">إرسال طلب تعديل</Link></p></div>
      <Field label="رابط أو رقم واتساب" name="whatsapp" defaultValue={store.socialLinks?.whatsapp || ""} placeholder="https://wa.me/967... أو رقم" />
      <Field label="فيسبوك" name="facebook" defaultValue={store.socialLinks?.facebook || ""} />
      <Field label="إنستغرام" name="instagram" defaultValue={store.socialLinks?.instagram || ""} />
      <Field label="رابط فيديو تعريفي" name="videoUrl" defaultValue={store.videoUrl || ""} />
      <div className="flex items-center gap-3 md:col-span-2"><Button disabled={loading}><Save className="h-4 w-4" /> {loading ? "جارٍ الحفظ..." : "حفظ بيانات التواصل"}</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
    </form>
  );
}

function Field({ label, name, type = "text", defaultValue = "", placeholder = "" }: { label: string; name: string; type?: string; defaultValue?: string; placeholder?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} /></div>;
}
