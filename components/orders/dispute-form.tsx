"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function DisputeForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setLoading(true);
    const response = await fetch(`/api/orders/${orderId}/disputes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: data.get("reason"), description: data.get("description") }) });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر فتح النزاع");
    setMessage("✓ تم فتح النزاع وسيتم إشعار الإدارة والتاجر");
    form.reset();
    router.refresh();
  }

  if (!open) return <Button type="button" variant="destructive" onClick={() => setOpen(true)}><AlertTriangle className="h-4 w-4" /> فتح نزاع على الطلب</Button>;

  return (
    <form onSubmit={submit} className="rounded-3xl border border-red-100 bg-red-50 p-5">
      <h3 className="font-black text-red-950">فتح نزاع</h3>
      <p className="mt-1 text-sm leading-6 text-red-700">استخدم هذا الخيار إذا كان المنتج المستلم مختلفاً عن الفاتورة أو المواصفات.</p>
      <div className="mt-4 grid gap-3">
        <div className="space-y-2"><Label>سبب النزاع</Label><select name="reason" className="h-11 rounded-xl border bg-white px-4 text-sm"><option value="wrong_item">منتج مختلف</option><option value="wrong_variant">لون/مقاس/مواصفة مختلفة</option><option value="damaged">المنتج تالف</option><option value="missing_item">منتج ناقص</option><option value="other">أخرى</option></select></div>
        <div className="space-y-2"><Label>التفاصيل</Label><Textarea name="description" required placeholder="اشرح الفرق بين الفاتورة وما استلمته..." /></div>
        <div className="flex gap-2"><Button disabled={loading}>{loading ? "جارٍ الإرسال..." : "إرسال النزاع"}</Button><Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button></div>
        {message ? <p className="text-sm font-bold text-red-700">{message}</p> : null}
      </div>
    </form>
  );
}
