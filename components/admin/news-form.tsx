"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function AdminNewsForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewLink, setPreviewLink] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/admin/news", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formData.get("title"),
        body: formData.get("body") || undefined,
        linkUrl: formData.get("linkUrl") || "",
        isTicker: formData.get("isTicker") === "on",
        isPinned: formData.get("isPinned") === "on",
        startAt: formData.get("startAt") ? new Date(String(formData.get("startAt"))).toISOString() : null,
        endAt: formData.get("endAt") ? new Date(String(formData.get("endAt"))).toISOString() : null,
        status: formData.get("status")
      })
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر الحفظ");
    formElement.reset();
    setPreviewLink("/");
    setMessage("✓ تم حفظ الخبر بنجاح");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2">
      <Field label="عنوان الخبر" name="title" required />
      <Field label="رابط الانتقال" name="linkUrl" />
      <Field label="تاريخ البداية" name="startAt" type="datetime-local" />
      <Field label="تاريخ النهاية" name="endAt" type="datetime-local" />
      <div className="space-y-2"><Label htmlFor="status">الحالة</Label><select id="status" name="status" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="draft">مسودة</option><option value="scheduled">مجدول</option><option value="active">نشط</option><option value="disabled">معطل</option></select></div>
      <div className="flex items-center gap-6 rounded-2xl bg-slate-50 px-4"><label className="flex items-center gap-2 text-sm font-bold"><input name="isTicker" type="checkbox" defaultChecked /> شريط متحرك</label><label className="flex items-center gap-2 text-sm font-bold"><input name="isPinned" type="checkbox" /> مثبت</label></div>
      <div className="space-y-2 md:col-span-2"><Label htmlFor="body">النص</Label><Textarea id="body" name="body" /></div>
      <div className="flex items-center gap-3 md:col-span-2"><Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ الخبر"}</Button>{previewLink ? <Button asChild variant="outline"><a href={previewLink} target="_blank">معاينة في الرئيسية</a></Button> : null}{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
    </form>
  );
}

function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} /></div>;
}
