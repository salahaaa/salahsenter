"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, CheckCircle2, MapPin, PlusCircle, Store, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatNumber } from "@/lib/utils";

type WingOption = { id: string; name: string };
type CountryOption = { id: string; name: string };
type GovernorateOption = { id: string; name: string; countryId: string };
type CityOption = { id: string; name: string; governorateId: string };
type DistrictOption = { id: string; name: string; cityId: string };
type BranchRow = { store: any; branch: any | null; group: any | null; addendum: any | null };
type Invoice = { id: string; invoiceNumber: string; amount: string; currency: string; status: string; dueAt: string | Date | null; storeId: string };

export function BranchManagementPanel({ branches, invoices, wings, countries, governorates, cities, districts, rent, activeStoreId }: { branches: BranchRow[]; invoices: Invoice[]; wings: WingOption[]; countries: CountryOption[]; governorates: GovernorateOption[]; cities: CityOption[]; districts: DistrictOption[]; rent: { totalMonthly: number; pendingInvoices: number; overdueInvoices: number }; activeStoreId?: string | null }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countryId, setCountryId] = useState("");
  const [governorateId, setGovernorateId] = useState("");
  const [cityId, setCityId] = useState("");
  const filteredGovernorates = useMemo(() => governorates.filter((item) => item.countryId === countryId), [countryId, governorates]);
  const filteredCities = useMemo(() => cities.filter((item) => item.governorateId === governorateId), [cities, governorateId]);
  const filteredDistricts = useMemo(() => districts.filter((item) => item.cityId === cityId), [districts, cityId]);

  async function createBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setLoading(true);
    const response = await fetch("/api/merchant/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchName: data.get("branchName"),
        countryId: data.get("countryId") || undefined,
        governorateId: data.get("governorateId") || undefined,
        cityId: data.get("cityId") || undefined,
        districtId: data.get("districtId") || undefined,
        address: data.get("address"),
        contactPhone: data.get("contactPhone"),
        contactEmail: data.get("contactEmail") || undefined,
        primaryWingId: data.get("primaryWingId") || null,
        notes: data.get("notes")
      })
    });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? "✓ تم إنشاء طلب الفرع وربطه بنفس حسابك" : json.message || "تعذر إنشاء الفرع");
    if (response.ok) { form.reset(); setCountryId(""); setGovernorateId(""); setCityId(""); router.refresh(); }
  }

  async function selectStore(storeId: string) {
    setLoading(true);
    const response = await fetch("/api/merchant/active-store", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId }) });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? json.data.message : json.message || "تعذر اختيار المحل");
    if (response.ok) router.refresh();
  }

  async function copySettings(storeId: string) {
    if (!window.confirm("سيتم نسخ الأصناف والخصائص والوحدات والألوان والشحن والدفع والوسائط من المتجر الرئيسي إلى هذا الفرع. هل تريد المتابعة؟")) return;
    setLoading(true);
    const response = await fetch("/api/merchant/branches/copy-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchStoreId: storeId }) });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? `✓ ${json.data.message}` : json.message || "تعذر سحب الإعدادات");
    if (response.ok) router.refresh();
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-4">
        <Stat title="عدد المحلات والفروع" value={formatNumber(branches.length)} icon={<Building2 className="h-5 w-5" />} />
        <Stat title="الإيجار الشهري التقريبي" value={formatCurrency(rent.totalMonthly)} icon={<WalletCards className="h-5 w-5" />} />
        <Stat title="فواتير معلقة" value={formatNumber(rent.pendingInvoices)} icon={<WalletCards className="h-5 w-5" />} />
        <Stat title="فواتير متأخرة" value={formatNumber(rent.overdueInvoices)} icon={<WalletCards className="h-5 w-5" />} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_.9fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><PlusCircle className="h-5 w-5 text-blue-600" /> فتح محل / فرع إضافي</CardTitle><p className="text-sm leading-7 text-slate-500">هذا ليس طلب تاجر جديد. سيتم ربط الفرع بنفس حساب التاجر ونفس بيانات الدخول، مع إيجار مستقل لكل محل بعد اعتماد الإدارة.</p></CardHeader>
          <CardContent>
            <form onSubmit={createBranch} className="grid gap-4 md:grid-cols-2">
              <Field label="اسم الفرع" name="branchName" required placeholder="فرع تعز / فرع صنعاء" />
              <Field label="جوال الفرع" name="contactPhone" />
              <Field label="بريد الفرع" name="contactEmail" type="email" />
              <div className="space-y-2"><Label>الجناح التجاري</Label><select name="primaryWingId" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">نفس جناح المحل الرئيسي أو لاحقاً</option>{wings.map((wing) => <option key={wing.id} value={wing.id}>{wing.name}</option>)}</select></div>
              <div className="space-y-2"><Label>الدولة</Label><select name="countryId" value={countryId} onChange={(event) => { setCountryId(event.target.value); setGovernorateId(""); setCityId(""); }} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">اختر الدولة</option>{countries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}</select></div>
              <div className="space-y-2"><Label>المحافظة</Label><select name="governorateId" value={governorateId} onChange={(event) => { setGovernorateId(event.target.value); setCityId(""); }} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">اختر المحافظة</option>{filteredGovernorates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div className="space-y-2"><Label>المدينة</Label><select name="cityId" value={cityId} onChange={(event) => setCityId(event.target.value)} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">اختر المدينة</option>{filteredCities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div className="space-y-2"><Label>المنطقة</Label><select name="districtId" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">اختر المنطقة</option>{filteredDistricts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-800 md:col-span-2">قيمة الإيجار ومدة الإيجار يحددها الأدمن عند اعتماد الفرع، ولا يحددها التاجر في طلب فتح الفرع.</div>
              <div className="space-y-2 md:col-span-2"><Label>العنوان التفصيلي</Label><Textarea name="address" placeholder="الشارع / الحي / أقرب معلم" /></div>
              <div className="space-y-2 md:col-span-2"><Label>ملاحظات</Label><Textarea name="notes" placeholder="أي تفاصيل يحتاجها الأدمن لاعتماد الفرع" /></div>
              <div className="flex items-center gap-3 md:col-span-2"><Button disabled={loading}>{loading ? "جارٍ الإرسال..." : "إرسال طلب الفرع"}</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>فواتير إيجار المحلات</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {invoices.length ? invoices.slice(0, 8).map((invoice) => <div key={invoice.id} className="rounded-2xl border bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><p className="font-black">{invoice.invoiceNumber}</p><Badge variant={invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "danger" : "warning"}>{invoice.status}</Badge></div><p className="mt-2 font-black text-primary">{formatCurrency(invoice.amount, invoice.currency)}</p><p className="text-xs text-slate-500">تاريخ الاستحقاق: {invoice.dueAt ? new Intl.DateTimeFormat("ar").format(new Date(invoice.dueAt)) : "-"}</p></div>) : <p className="rounded-2xl border border-dashed bg-slate-50 p-5 text-sm font-bold text-slate-400">لا توجد فواتير إيجار بعد.</p>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {branches.map(({ store, branch, group, addendum }) => <article key={store.id} className="rounded-3xl border bg-white p-5 shadow-card"><div className="flex items-start justify-between gap-3"><div><div className="mb-2 flex flex-wrap gap-2"><Badge variant={store.status === "active" ? "success" : "warning"}>{store.status}</Badge>{branch?.approvalStatus ? <Badge variant={branch.approvalStatus === "approved" ? "success" : branch.approvalStatus === "rejected" ? "danger" : "warning"}>{branch.approvalStatus}</Badge> : null}{activeStoreId === store.id ? <Badge>نشط للإدارة</Badge> : null}</div><h3 className="text-xl font-black text-slate-950">{store.name}</h3><p className="mt-1 text-xs font-bold text-slate-500">{store.storeNumber} • {branch?.branchCode || "محل"}</p></div><Store className="h-8 w-8 text-blue-500" /></div><div className="mt-4 space-y-2 text-sm text-slate-600"><p><MapPin className="ml-1 inline h-4 w-4" /> {branch?.address || "لم يحدد العنوان"}</p><p>المجموعة التجارية: <b>{group?.companyName || store.name}</b></p><p>الإيجار: <b>{formatCurrency(branch?.rentAmount || 0, branch?.rentCurrency || "YER")}</b> / {cycleLabel(branch?.rentCycle)}</p>{branch?.financialMode === "platform_revenue" ? <p className="text-xs font-bold text-violet-700">الدورة المالية: إيرادات منصة موحدة — راجع كشف المنصة.</p> : <p className="text-xs font-bold text-amber-700">الدورة المالية: فواتير فرع قديمة (Legacy).</p>}</div><div className="mt-5 flex flex-wrap gap-2"><Button type="button" size="sm" disabled={loading || store.status !== "active"} onClick={() => selectStore(store.id)}>{activeStoreId === store.id ? <CheckCircle2 className="h-4 w-4" /> : null} إدارة هذا المحل</Button>{addendum?.status === "pending_signature" ? <Button asChild size="sm" variant="outline"><Link href={`/merchant/contract-addendums/${addendum.id}`}>توقيع ملحق الفرع</Link></Button> : null}{branch?.branchType === "branch" && branch?.approvalStatus === "approved" ? <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => copySettings(store.id)}>سحب إعدادات الرئيسي</Button> : null}<Button asChild size="sm" variant="outline"><Link href={`/store/${store.slug}?preview=1`}>معاينة</Link></Button></div></article>)}
      </section>
    </div>
  );
}

function Field({ label, name, type = "text", required = false, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) { return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} required={required} placeholder={placeholder} /></div>; }
function Stat({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) { return <Card><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-sm text-slate-500"><span>{title}</span><span className="text-blue-500">{icon}</span></CardTitle></CardHeader><CardContent><p className="text-2xl font-black text-slate-950">{value}</p></CardContent></Card>; }
function cycleLabel(value?: string) { return value === "annual" ? "سنوي" : value === "semi_annual" ? "نصف سنوي" : value === "quarterly" ? "ربع سنوي" : "شهري"; }
