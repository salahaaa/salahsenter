"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Owner = { fullName: string; email: string; password: string };
export function BootstrapOwnerForm() {
  const router = useRouter();
  const [owners, setOwners] = useState<Owner[]>([{ fullName: "", email: "", password: "" }, { fullName: "", email: "", password: "" }]);
  const [loading, setLoading] = useState(false); const [message, setMessage] = useState<string | null>(null);
  function patch(index: number, key: keyof Owner, value: string) { setOwners((current) => current.map((owner, row) => row === index ? { ...owner, [key]: value } : owner)); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setMessage(null);
    const response = await fetch("/api/bootstrap/owners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ owners }) });
    const json = await response.json().catch(() => ({})); setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر إنشاء حسابي المالك");
    setMessage("تم إنشاء الحسابين. سجّل الدخول الآن بأحد البريدين.");
    window.setTimeout(() => router.push("/login"), 1500);
  }
  return <form onSubmit={submit} className="space-y-6 rounded-[2rem] border bg-white p-6 shadow-card"><div><h1 className="text-3xl font-black">تهيئة مالكي المنصة</h1><p className="mt-2 text-sm leading-7 text-slate-600">هذه التذكرة صالحة لجلسة التصفية فقط ولمدة قصيرة. أنشئ حسابين مستقلين للمالك؛ استخدم أيهما عند فقدان أو تسريب الحساب الآخر.</p></div><div className="grid gap-5 md:grid-cols-2">{owners.map((owner, index) => <section key={index} className="space-y-3 rounded-2xl border bg-slate-50 p-4"><h2 className="font-black">المالك رقم {index + 1}</h2><Field label="الاسم" value={owner.fullName} onChange={(value) => patch(index, "fullName", value)} /><Field label="البريد الإلكتروني" type="email" value={owner.email} onChange={(value) => patch(index, "email", value)} /><Field label="كلمة المرور (16 حرفاً على الأقل)" type="password" value={owner.password} onChange={(value) => patch(index, "password", value)} /></section>)}</div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-900">بعد الدخول لأول مرة، افتح مركز التحكم الحساس وعيّن كلمة مرور منفصلة له. تبقى المنصة في وضع القفل حتى تراجع الإعدادات وتعيد فتحها بنفسك.</div><Button disabled={loading}>{loading ? "جارٍ الإنشاء..." : "إنشاء حسابي المالك"}</Button>{message ? <p className="text-sm font-bold text-slate-700">{message}</p> : null}</form>;
}
function Field({ label, value, type = "text", onChange }: { label: string; value: string; type?: string; onChange: (value: string) => void }) { return <label className="block space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} required /></label>; }
