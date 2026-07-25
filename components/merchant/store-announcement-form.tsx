"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";

export function StoreAnnouncementForm({ storeId, storeSlug }: { storeId: string; storeSlug?: string }) {
  const router = useRouter();
  const [kind, setKind] = useState<"announcement" | "news">("announcement");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewLink, setPreviewLink] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const successKey = `store-content-saved:${storeId}`;

  useEffect(() => {
    const savedMessage = window.sessionStorage.getItem(successKey);
    if (savedMessage) {
      setMessage(savedMessage);
      setPreviewLink(storeSlug ? `/store/${storeSlug}?preview=1` : null);
      setSaved(true);
    }
  }, [successKey, storeSlug]);

  function resetForNewContent(form?: HTMLFormElement | null) {
    form?.reset();
    window.sessionStorage.removeItem(successKey);
    setMessage(null);
    setPreviewLink(null);
    setSaved(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saved || loading) return;
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setLoading(true);
    setMessage(null);
    const payload = {
      storeId,
      title: formData.get("title"),
      summary: formData.get("summary") || undefined,
      body: formData.get("body") || undefined,
      imageUrl: formData.get("imageUrl") || "",
      linkUrl: formData.get("linkUrl") || "",
      isPinned: formData.get("isPinned") === "on",
      isTicker: formData.get("isTicker") === "on",
      status: formData.get("status"),
      promotionPackage: formData.get("backgroundColor") || "",
      startAt: formData.get("startAt") ? new Date(String(formData.get("startAt"))).toISOString() : null,
      endAt: formData.get("endAt") ? new Date(String(formData.get("endAt"))).toISOString() : null
    };
    const endpoint = kind === "announcement" ? "/api/merchant/announcements" : "/api/merchant/news";
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر الحفظ");
    const successMessage = "✓ تم حفظ المحتوى بنجاح. تم تعطيل زر الحفظ لمنع التكرار — اضغط إضافة محتوى آخر إذا أردت إنشاء عنصر جديد.";
    formElement.reset();
    window.sessionStorage.setItem(successKey, successMessage);
    setPreviewLink(storeSlug ? `/store/${storeSlug}?preview=1` : null);
    setMessage(successMessage);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="kind">نوع المحتوى</Label><select id="kind" value={kind} onChange={(e) => { setKind(e.target.value as "announcement" | "news"); resetForNewContent(); }} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="announcement">إعلان / عرض</option><option value="news">خبر متحرك</option></select></div>
      <Field label="العنوان" name="title" required />
      {kind === "announcement" ? <MediaUrlInput label="صورة الإعلان: رابط أو رفع" name="imageUrl" storeId={storeId} folder={`stores/${storeId}/announcements`} accept="image/*" /> : null}
      <Field label="رابط التفاصيل" name="linkUrl" />
      <Field label="تاريخ البداية" name="startAt" type="datetime-local" />
      <Field label="تاريخ النهاية" name="endAt" type="datetime-local" />
      {kind === "announcement" ? <Field label="لون خلفية الإعلان" name="backgroundColor" type="color" /> : null}
      <div className="space-y-2"><Label htmlFor="status">الحالة</Label><select id="status" name="status" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="draft">مسودة</option><option value="scheduled">مجدول</option><option value="active">نشط</option><option value="disabled">معطل</option></select></div>
      <div className="flex items-center gap-6 rounded-2xl bg-slate-50 px-4"><label className="flex items-center gap-2 text-sm font-bold"><input name="isPinned" type="checkbox" /> تثبيت</label>{kind === "news" ? <label className="flex items-center gap-2 text-sm font-bold"><input name="isTicker" type="checkbox" defaultChecked /> شريط متحرك</label> : null}</div>
      <div className="space-y-2 md:col-span-2"><Label htmlFor="summary">وصف مختصر</Label><Textarea id="summary" name="summary" /></div>
      <div className="space-y-2 md:col-span-2"><Label htmlFor="body">التفاصيل</Label><Textarea id="body" name="body" /></div>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2"><Button disabled={loading || saved}>{loading ? "جارٍ الحفظ..." : saved ? "تم الحفظ ✓" : "حفظ"}</Button>{saved ? <Button type="button" variant="secondary" onClick={(event) => resetForNewContent(event.currentTarget.form)}>إضافة محتوى آخر</Button> : null}{previewLink ? <Button asChild variant="outline"><a href={previewLink} target="_blank">معاينة كما يراه العملاء</a></Button> : null}{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
    </form>
  );
}
function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} /></div>; }
