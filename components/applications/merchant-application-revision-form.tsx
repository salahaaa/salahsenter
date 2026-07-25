"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient, ApiClientError } from "@/lib/client/api-client";

type Option = { id: string; name: string };
type Governorate = Option & { countryId: string };
type City = Option & { governorateId: string };
type District = Option & { cityId: string };

type Application = {
  id: string;
  applicantName: string;
  applicantPhone?: string | null;
  storeName: string;
  businessActivity: string;
  description?: string | null;
  socialLinks?: Record<string, string>;
  wingId?: string | null;
  countryId?: string | null;
  governorateId?: string | null;
  cityId?: string | null;
  districtId?: string | null;
};

export function MerchantApplicationRevisionForm({
  application,
  wings,
  countries,
  governorates,
  cities,
  districts
}: {
  application: Application;
  wings: Option[];
  countries: Option[];
  governorates: Governorate[];
  cities: City[];
  districts: District[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [wingId, setWingId] = useState(application.wingId || "");
  const [countryId, setCountryId] = useState(application.countryId || "");
  const [governorateId, setGovernorateId] = useState(application.governorateId || "");
  const [cityId, setCityId] = useState(application.cityId || "");
  const [districtId, setDistrictId] = useState(application.districtId || "");
  const filteredGovernorates = useMemo(() => governorates.filter((item) => item.countryId === countryId), [governorates, countryId]);
  const filteredCities = useMemo(() => cities.filter((item) => item.governorateId === governorateId), [cities, governorateId]);
  const filteredDistricts = useMemo(() => districts.filter((item) => item.cityId === cityId), [districts, cityId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setMessage(null);
    try {
      const data = await apiClient.patch<any>(
        `/api/merchant-applications/${application.id}`,
        {
          applicantName: form.get("applicantName"),
          applicantPhone: form.get("applicantPhone"),
          storeName: form.get("storeName"),
          businessActivity: form.get("businessActivity"),
          description: form.get("description"),
          wingId: form.get("wingId"),
          countryId: form.get("countryId") || null,
          governorateId: form.get("governorateId") || null,
          cityId: form.get("cityId") || null,
          districtId: form.get("districtId") || null,
          socialLinks: {
            whatsapp: form.get("whatsapp") || "",
            facebook: form.get("facebook") || "",
            instagram: form.get("instagram") || ""
          }
        },
        { invalidateTags: [`application:${application.id}`] }
      );
      setMessage(data.message || "تمت إعادة إرسال الطلب");
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof ApiClientError ? caught.message : "تعذر إعادة إرسال الطلب");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-[2rem] border border-amber-200 bg-amber-50/50 p-6 shadow-card md:grid-cols-2">
      <div className="md:col-span-2">
        <h2 className="text-xl font-black text-slate-950">تعديل طلب فتح المتجر</h2>
        <p className="mt-1 text-sm leading-7 text-slate-600">راجع ملاحظة الإدارة، ثم اختر الجناح؛ فهو قطاع المتجر نفسه ويحدد قالب التجهيز تلقائياً دون اختيار ثانٍ.</p>
      </div>
      <Field label="اسم مقدم الطلب" name="applicantName" defaultValue={application.applicantName} />
      <Field label="رقم الجوال" name="applicantPhone" defaultValue={application.applicantPhone || ""} />
      <Field label="اسم المتجر" name="storeName" defaultValue={application.storeName} />
      <Field label="وصف النشاط التجاري" name="businessActivity" defaultValue={application.businessActivity} />
      <Select label="الجناح / قطاع النشاط" name="wingId" value={wingId} options={wings} required onChange={setWingId} />
      <Select label="الدولة" name="countryId" value={countryId} options={countries} onChange={(value) => { setCountryId(value); setGovernorateId(""); setCityId(""); setDistrictId(""); }} />
      <Select label="المحافظة" name="governorateId" value={governorateId} options={filteredGovernorates} onChange={(value) => { setGovernorateId(value); setCityId(""); setDistrictId(""); }} />
      <Select label="المدينة" name="cityId" value={cityId} options={filteredCities} onChange={(value) => { setCityId(value); setDistrictId(""); }} />
      <Select label="المنطقة" name="districtId" value={districtId} options={filteredDistricts} onChange={setDistrictId} />
      <div className="space-y-2 md:col-span-2"><Label>وصف المتجر</Label><Textarea name="description" defaultValue={application.description || ""} required /></div>
      <Field label="واتساب" name="whatsapp" defaultValue={application.socialLinks?.whatsapp || ""} optional />
      <Field label="فيسبوك" name="facebook" defaultValue={application.socialLinks?.facebook || ""} optional />
      <Field label="إنستغرام" name="instagram" defaultValue={application.socialLinks?.instagram || ""} optional />
      <div className="md:col-span-2"><Button disabled={loading}>{loading ? "جارٍ الإرسال..." : "حفظ وإعادة الطلب للمراجعة"}</Button>{message ? <span className="mr-3 text-sm font-bold text-slate-700">{message}</span> : null}</div>
    </form>
  );
}

function Field({ label, name, defaultValue, optional = false }: { label: string; name: string; defaultValue: string; optional?: boolean }) {
  return <label className="space-y-2 text-sm font-black text-slate-700"><span>{label}</span><Input name={name} defaultValue={defaultValue} required={!optional} /></label>;
}

function Select({ label, name, value, options, onChange, required = false }: { label: string; name: string; value: string; options: Option[]; onChange?: (value: string) => void; required?: boolean }) {
  return <label className="space-y-2 text-sm font-black text-slate-700"><span>{label}</span><select name={name} value={value} required={required} onChange={(event) => onChange?.(event.target.value)} className="h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="">اختر</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}
