"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type NewsItem = {
  id: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  isTicker: boolean;
  isPinned: boolean;
  status: string;
  startAt: Date | string | null;
  endAt: Date | string | null;
};

function toDatetimeLocal(value: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function NewsInlineEditor({ item, endpoint }: { item: NewsItem; endpoint: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setLoading(true);
    setMessage(null);
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formData.get("title"),
        body: formData.get("body") || undefined,
        linkUrl: formData.get("linkUrl") || "",
        isTicker: formData.get("isTicker") === "on",
        isPinned: formData.get("isPinned") === "on",
        status: formData.get("status"),
        startAt: formData.get("startAt") ? new Date(String(formData.get("startAt"))).toISOString() : null,
        endAt: formData.get("endAt") ? new Date(String(formData.get("endAt"))).toISOString() : null
      })
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر التعديل");
    setMessage("✓ تم تعديل الخبر");
    setEditing(false);
    router.refresh();
  }

  if (!editing) return <Button size="sm" variant="outline" onClick={() => setEditing(true)}>تعديل</Button>;

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 rounded-2xl border bg-slate-50 p-4 md:grid-cols-2">
      <Field label="العنوان" name="title" defaultValue={item.title} required />
      <Field label="الرابط" name="linkUrl" defaultValue={item.linkUrl || ""} />
      <Field label="البداية" name="startAt" type="datetime-local" defaultValue={toDatetimeLocal(item.startAt)} />
      <Field label="النهاية" name="endAt" type="datetime-local" defaultValue={toDatetimeLocal(item.endAt)} />
      <div className="space-y-2"><Label>الحالة</Label><select name="status" defaultValue={item.status} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="draft">مسودة</option><option value="scheduled">مجدول</option><option value="active">نشط</option><option value="expired">منتهي</option><option value="disabled">معطل</option></select></div>
      <div className="flex items-center gap-4 rounded-xl bg-white px-4"><label className="flex items-center gap-2 text-sm font-bold"><input name="isTicker" type="checkbox" defaultChecked={item.isTicker} /> شريط متحرك</label><label className="flex items-center gap-2 text-sm font-bold"><input name="isPinned" type="checkbox" defaultChecked={item.isPinned} /> مثبت</label></div>
      <div className="space-y-2 md:col-span-2"><Label>النص</Label><Textarea name="body" defaultValue={item.body || ""} /></div>
      <div className="flex items-center gap-2 md:col-span-2"><Button size="sm" disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ التعديل"}</Button><Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>إلغاء</Button>{message ? <span className="text-xs font-bold text-slate-500">{message}</span> : null}</div>
    </form>
  );
}

function Field({ label, name, type = "text", defaultValue = "", required = false }: { label: string; name: string; type?: string; defaultValue?: string; required?: boolean }) {
  return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} defaultValue={defaultValue} required={required} /></div>;
}
