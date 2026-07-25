"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CmsPageForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const f = new FormData(formElement);
    const response = await fetch("/api/admin/cms/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: f.get("title"), slug: f.get("slug") || undefined, type: f.get("type") || "page", excerpt: f.get("excerpt") || undefined, content: f.get("content") || "", status: f.get("status") }) });
    const data = await response.json();
    setMessage(response.ok ? "✓ تم حفظ الصفحة" : data.message || "تعذر الحفظ");
    if (response.ok) { formElement.reset(); router.refresh(); }
  }
  return <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2"><Field label="العنوان" name="title" required /><Field label="Slug" name="slug" /><Field label="النوع" name="type" placeholder="page / faq / terms / privacy / article" /><div className="space-y-2"><Label>الحالة</Label><select name="status" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="draft">مسودة</option><option value="active">نشط</option><option value="disabled">معطل</option></select></div><div className="space-y-2 md:col-span-2"><Label>ملخص</Label><Textarea name="excerpt" /></div><div className="space-y-2 md:col-span-2"><Label>المحتوى</Label><Textarea name="content" className="min-h-60" /></div><div className="flex items-center gap-3 md:col-span-2"><Button>حفظ الصفحة</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div></form>;
}
function Field({ label, name, required = false, placeholder }: { label: string; name: string; required?: boolean; placeholder?: string }) { return <div className="space-y-2"><Label>{label}</Label><Input name={name} required={required} placeholder={placeholder || ""} /></div>; }
