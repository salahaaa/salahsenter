"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TenantForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/admin/tenants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), slug: data.get("slug") || undefined, plan: data.get("plan"), domain: data.get("domain") || undefined, isWhiteLabel: data.get("isWhiteLabel") === "on" }) });
    const json = await response.json();
    setMessage(response.ok ? "✓ تم إنشاء المستأجر" : json.message || "تعذر الإنشاء");
    if (response.ok) { form.reset(); router.refresh(); }
  }
  return <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2"><Field label="اسم المستأجر" name="name" required/><Field label="Slug" name="slug"/><Field label="Domain/Subdomain" name="domain"/><div className="space-y-2"><Label>الخطة</Label><select name="plan" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="starter">Starter</option><option value="professional">Professional</option><option value="business">Business</option><option value="enterprise">Enterprise</option></select></div><label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold"><input type="checkbox" name="isWhiteLabel"/> White Label</label><div className="flex items-center gap-3 md:col-span-2"><Button>إنشاء مستأجر</Button>{message?<span className="text-sm font-bold text-slate-600">{message}</span>:null}</div></form>
}
function Field({label,name,required=false}:{label:string;name:string;required?:boolean}){return <div className="space-y-2"><Label>{label}</Label><Input name={name} required={required}/></div>}
