"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaUrlInput } from "@/components/media/media-url-input";

type Media = { id: string; mediaType: "cover" | "logo" | "intro" | "gallery" | "video" | "banner" | "icon"; url: string; alt: string | null; sortOrder: number; isActive: boolean };

export function DefaultMediaEditForm({ media }: { media: Media }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch(`/api/admin/default-media/${media.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaType: data.get("mediaType"),
        url: data.get("url"),
        alt: data.get("alt") || undefined,
        sortOrder: Number(data.get("sortOrder") || 0),
        isActive: data.get("isActive") === "on"
      })
    });
    const json = await response.json();
    setMessage(response.ok ? "✓ تم تعديل الصورة" : json.message || "تعذر التعديل");
    if (response.ok) { setEditing(false); router.refresh(); }
  }

  if (!editing) return <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>تعديل</Button>;

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl border bg-slate-50 p-4">
      <div className="space-y-2"><Label>نوع الصورة</Label><select name="mediaType" defaultValue={media.mediaType} className="h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="cover">غلاف</option><option value="logo">شعار</option><option value="intro">تعريفية</option><option value="banner">بانر</option><option value="gallery">معرض</option><option value="icon">أيقونة</option></select></div>
      <MediaUrlInput label="الصورة: رابط أو رفع" name="url" defaultValue={media.url} folder="admin/default-media" accept="image/*" />
      <div className="space-y-2"><Label>النص البديل</Label><Input name="alt" defaultValue={media.alt || ""} /></div>
      <div className="space-y-2"><Label>الترتيب</Label><Input name="sortOrder" type="number" defaultValue={media.sortOrder} /></div>
      <label className="flex items-center gap-2 text-sm font-bold"><input name="isActive" type="checkbox" defaultChecked={media.isActive} /> نشط</label>
      <div className="flex gap-2"><Button size="sm">حفظ</Button><Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>إلغاء</Button></div>
      {message ? <p className="text-xs font-bold text-slate-500">{message}</p> : null}
    </form>
  );
}
