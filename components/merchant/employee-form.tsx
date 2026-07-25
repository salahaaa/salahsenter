"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const permissionOptions = [
  { code: "merchant.access", label: "دخول لوحة التاجر" },
  { code: "products.manage", label: "إدارة المنتجات" },
  { code: "inventory.manage", label: "إدارة المخزون" },
  { code: "orders.manage", label: "إدارة الطلبات" },
  { code: "store_media.manage", label: "إدارة الوسائط" },
  { code: "store_settings.manage", label: "إعدادات المتجر" },
  { code: "announcements.manage", label: "العروض والأخبار" }
];

export function EmployeeForm({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setLoading(true);
    setMessage(null);
    const permissionCodes = permissionOptions.map((p) => p.code).filter((code) => formData.get(code) === "on");
    const response = await fetch("/api/merchant/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, fullName: formData.get("fullName"), email: formData.get("email"), phone: formData.get("phone") || undefined, jobTitle: formData.get("jobTitle") || undefined, password: formData.get("password") || undefined, permissionCodes })
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر إنشاء الموظف");
    formElement.reset();
    setMessage(json.data.temporaryPassword ? `✓ تم إنشاء الموظف. كلمة المرور المؤقتة: ${json.data.temporaryPassword}` : "✓ تم إنشاء الموظف بنجاح");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2">
      <Field label="اسم الموظف" name="fullName" required /><Field label="البريد" name="email" type="email" required /><Field label="الجوال" name="phone" /><Field label="المسمى الوظيفي" name="jobTitle" /><Field label="كلمة مرور اختيارية" name="password" type="password" />
      <div className="space-y-3 md:col-span-2"><Label>الصلاحيات</Label><div className="grid gap-2 md:grid-cols-3">{permissionOptions.map((p) => <label key={p.code} className="flex items-center gap-2 rounded-xl border bg-slate-50 p-3 text-sm font-bold"><input name={p.code} type="checkbox" defaultChecked={p.code === "merchant.access"} /> {p.label}</label>)}</div></div>
      <div className="flex items-center gap-3 md:col-span-2"><Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "إضافة الموظف"}</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
    </form>
  );
}
function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} /></div>; }
