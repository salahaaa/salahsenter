"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionGate } from "@/components/permissions/permission-gate";

type Provider = {
  id: string; name: string; slug: string; type: string; status: string; logoUrl: string | null; countryCode: string | null; currencyCode: string;
  isEnabled: boolean; isVisibleToMerchants: boolean; supportsDeposits: boolean; supportsWithdrawals: boolean; supportsRefunds: boolean; supportsCOD: boolean; featureFlags: Record<string, unknown>; sortOrder: number;
};

const types = ["bank", "wallet", "gateway", "hawala", "cod"];
const statuses = ["active", "disabled", "restricted", "blocked", "maintenance"];

export function FinancialProviderManagementPanel({ initialProviders }: { initialProviders: Provider[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function create(formData: FormData) {
    setLoading(true);
    const response = await fetch("/api/admin/financial-providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(readForm(formData)) });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? "✓ تم إنشاء المزود" : json.message || "تعذر الإنشاء");
    if (response.ok) router.refresh();
  }

  async function quickPatch(id: string, patch: Record<string, unknown>) {
    setLoading(true);
    const response = await fetch(`/api/admin/financial-providers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    setMessage(response.ok ? "✓ تم التحديث" : json.message || "تعذر التحديث");
    if (response.ok) router.refresh();
  }

  return (
    <div className="space-y-8">
      {message ? <div className="rounded-2xl border bg-white p-4 text-sm font-bold text-slate-700 shadow-card">{message}</div> : null}
      <PermissionGate anyOf={["providers.add", "payments.manage"]}><form action={create} className="grid gap-4 rounded-[2rem] border bg-white p-6 shadow-card md:grid-cols-4">
        <div className="md:col-span-4"><h2 className="text-xl font-black">إضافة مزود مالي مركزي</h2><p className="mt-1 text-sm text-slate-500">البنوك والمحافظ والبوابات والحوالات والدفع عند الاستلام لا تضاف من التاجر بل من هنا.</p></div>
        <Field label="الاسم" name="name" required />
        <Field label="Slug" name="slug" />
        <Select label="النوع" name="type" options={types} />
        <Select label="الحالة" name="status" options={statuses} />
        <Field label="الدولة" name="countryCode" placeholder="YE" />
        <Field label="العملة" name="currencyCode" defaultValue="YER" />
        <Field label="ترتيب" name="sortOrder" type="number" defaultValue="0" />
        <Field label="شعار" name="logoUrl" />
        <Toggle name="isEnabled" label="مفعل" defaultChecked />
        <Toggle name="isVisibleToMerchants" label="ظاهر للتجار" defaultChecked />
        <Toggle name="supportsDeposits" label="يدعم الدفع/الإيداع" defaultChecked />
        <Toggle name="supportsWithdrawals" label="يدعم السحب" />
        <Toggle name="supportsRefunds" label="يدعم الاسترداد" />
        <Toggle name="supportsCOD" label="يدعم COD" />
        <div className="md:col-span-4"><Button disabled={loading}>حفظ المزود</Button></div>
      </form></PermissionGate>

      <section className="rounded-[2rem] border bg-white p-6 shadow-card">
        <h2 className="mb-5 text-xl font-black">مزودو الخدمات المالية</h2>
        <div className="overflow-auto rounded-2xl border">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 text-right">المزود</th><th className="p-3">النوع</th><th className="p-3">الحالة</th><th className="p-3">للتجار</th><th className="p-3">الخدمات</th><th className="p-3">تحكم سريع</th></tr></thead>
            <tbody>
              {initialProviders.map((provider) => <tr key={provider.id} className="border-t"><td className="p-3 text-right"><b>{provider.name}</b><p className="text-xs text-slate-400">{provider.slug} • {provider.currencyCode}</p></td><td className="p-3 text-center"><Badge variant="outline">{provider.type}</Badge></td><td className="p-3 text-center"><Badge variant={provider.status === "active" && provider.isEnabled ? "success" : provider.status === "blocked" ? "danger" : "warning"}>{provider.status}</Badge></td><td className="p-3 text-center">{provider.isVisibleToMerchants ? "نعم" : "مخفي"}</td><td className="p-3 text-xs">دفع:{yes(provider.supportsDeposits)} سحب:{yes(provider.supportsWithdrawals)} استرداد:{yes(provider.supportsRefunds)} COD:{yes(provider.supportsCOD)}</td><td className="p-3"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => quickPatch(provider.id, { isEnabled: !provider.isEnabled })}>{provider.isEnabled ? "إيقاف" : "تفعيل"}</Button><Button size="sm" variant="outline" onClick={() => quickPatch(provider.id, { isVisibleToMerchants: !provider.isVisibleToMerchants })}>{provider.isVisibleToMerchants ? "إخفاء" : "إظهار"}</Button><Button size="sm" variant="destructive" onClick={() => quickPatch(provider.id, { status: "blocked", isEnabled: false, isVisibleToMerchants: false })}>حظر فوري</Button></div></td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function readForm(formData: FormData) {
  return { name: formData.get("name"), slug: formData.get("slug") || undefined, type: formData.get("type"), status: formData.get("status"), logoUrl: formData.get("logoUrl") || undefined, countryCode: formData.get("countryCode") || undefined, currencyCode: formData.get("currencyCode") || "YER", sortOrder: Number(formData.get("sortOrder") || 0), isEnabled: formData.get("isEnabled") === "on", isVisibleToMerchants: formData.get("isVisibleToMerchants") === "on", supportsDeposits: formData.get("supportsDeposits") === "on", supportsWithdrawals: formData.get("supportsWithdrawals") === "on", supportsRefunds: formData.get("supportsRefunds") === "on", supportsCOD: formData.get("supportsCOD") === "on", featureFlags: { supportsMerchantPayouts: formData.get("supportsWithdrawals") === "on", supportsCustomerPayments: formData.get("supportsDeposits") === "on", supportsRefunds: formData.get("supportsRefunds") === "on", supportsSettlements: false } };
}
function yes(v: boolean) { return v ? "✓" : "—"; }
function Field({ label, name, type = "text", required, placeholder, defaultValue }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string }) { return <label className="space-y-2"><Label>{label}</Label><Input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} /></label>; }
function Select({ label, name, options }: { label: string; name: string; options: string[] }) { return <label className="space-y-2"><Label>{label}</Label><select name={name} className="h-11 w-full rounded-xl border bg-white px-4 text-sm">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; }
function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) { return <label className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-sm font-bold"><input name={name} type="checkbox" defaultChecked={defaultChecked} /> {label}</label>; }
