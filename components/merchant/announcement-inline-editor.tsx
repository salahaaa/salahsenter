"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";

type AnnouncementItem = { id: string; title: string; summary?: string | null; body?: string | null; imageUrl?: string | null; linkUrl?: string | null; status: string; isPinned: boolean; promotionPackage?: string | null; startAt?: Date | string | null; endAt?: Date | string | null };
function toDatetimeLocal(value?: Date | string | null) { if (!value) return ""; const d = new Date(value); return Number.isFinite(d.getTime()) ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""; }

export function AnnouncementInlineEditor({ item, endpoint, storeId }: { item: AnnouncementItem; endpoint: string; storeId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setLoading(true);
    const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: f.get("title"), summary: f.get("summary") || undefined, body: f.get("body") || undefined, imageUrl: f.get("imageUrl") || "", linkUrl: f.get("linkUrl") || "", status: f.get("status"), isPinned: f.get("isPinned") === "on", promotionPackage: f.get("backgroundColor") || "", startAt: f.get("startAt") ? new Date(String(f.get("startAt"))).toISOString() : null, endAt: f.get("endAt") ? new Date(String(f.get("endAt"))).toISOString() : null }) });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر التعديل");
    setEditing(false); setMessage("✓ تم تعديل الإعلان"); router.refresh();
  }
  if (!editing) return <Button size="sm" variant="outline" onClick={() => setEditing(true)}>تعديل الإعلان</Button>;
  return <form onSubmit={submit} className="mt-4 grid gap-3 rounded-2xl border bg-slate-50 p-4 md:grid-cols-2"><Field label="العنوان" name="title" defaultValue={item.title} required /><Field label="الرابط" name="linkUrl" defaultValue={item.linkUrl || ""} /><Field label="البداية" name="startAt" type="datetime-local" defaultValue={toDatetimeLocal(item.startAt)} /><Field label="النهاية" name="endAt" type="datetime-local" defaultValue={toDatetimeLocal(item.endAt)} /><div className="space-y-2"><Label>الحالة</Label><select name="status" defaultValue={item.status} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="draft">مسودة</option><option value="scheduled">مجدول</option><option value="active">نشط</option><option value="expired">منتهي</option><option value="disabled">معطل</option></select></div><div className="space-y-2"><Label>لون خلفية الإعلان</Label><Input name="backgroundColor" type="color" defaultValue={/^#[0-9a-f]{6}$/i.test(item.promotionPackage || "") ? item.promotionPackage || "#ffffff" : "#ffffff"} /></div><div className="md:col-span-2"><MediaUrlInput label="صورة الإعلان" name="imageUrl" defaultValue={item.imageUrl || ""} storeId={storeId} folder={`stores/${storeId}/announcements`} accept="image/*" /></div><div className="space-y-2 md:col-span-2"><Label>ملخص</Label><Textarea name="summary" defaultValue={item.summary || ""} /></div><div className="space-y-2 md:col-span-2"><Label>التفاصيل</Label><Textarea name="body" defaultValue={item.body || ""} /></div><label className="flex items-center gap-2 text-sm font-bold"><input name="isPinned" type="checkbox" defaultChecked={item.isPinned} /> تثبيت</label><div className="flex items-center gap-2 md:col-span-2"><Button size="sm" disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ التعديل"}</Button><Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>إلغاء</Button>{message ? <span className="text-xs font-bold text-slate-500">{message}</span> : null}</div></form>
}
function Field({ label, name, type = "text", defaultValue = "", required = false }: { label: string; name: string; type?: string; defaultValue?: string; required?: boolean }) { return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} defaultValue={defaultValue} required={required} /></div>; }
