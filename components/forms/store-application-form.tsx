"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardCheck, FileSignature, ShieldCheck, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; name: string };
type Governorate = Option & { countryId: string };
type City = Option & { governorateId: string };
type District = Option & { cityId: string };

export function StoreApplicationForm({
  wings,
  countries,
  governorates,
  cities,
  districts,
  currentUser,
  mode = "initial_store"
}: {
  /** Active wings already linked by the admin to their one catalogue template. */
  wings: Option[];
  countries: Option[];
  governorates: Governorate[];
  cities: City[];
  districts: District[];
  currentUser?: { fullName: string; email: string };
  mode?: "initial_store" | "independent_store";
}) {
  const [wingId, setWingId] = useState("");
  const [countryId, setCountryId] = useState("");
  const [governorateId, setGovernorateId] = useState("");
  const [cityId, setCityId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submittedApplication, setSubmittedApplication] = useState<{ id: string; storeName: string } | null>(null);

  const filteredGovernorates = useMemo(() => governorates.filter((item) => item.countryId === countryId), [countryId, governorates]);
  const filteredCities = useMemo(() => cities.filter((item) => item.governorateId === governorateId), [cities, governorateId]);
  const filteredDistricts = useMemo(() => districts.filter((item) => item.cityId === cityId), [districts, cityId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    const payload = {
      applicationType: mode,
      applicantName: formData.get("applicantName"),
      applicantEmail: formData.get("applicantEmail"),
      applicantPhone: formData.get("applicantPhone") || undefined,
      storeName: formData.get("storeName"),
      businessActivity: formData.get("businessActivity"),
      wingId: formData.get("wingId"),
      description: formData.get("description") || undefined,
      countryId: formData.get("countryId") || undefined,
      governorateId: formData.get("governorateId") || undefined,
      cityId: formData.get("cityId") || undefined,
      districtId: formData.get("districtId") || undefined,
      socialLinks: {
        whatsapp: formData.get("whatsapp") || "",
        facebook: formData.get("facebook") || "",
        instagram: formData.get("instagram") || ""
      }
    };

    const response = await fetch("/api/merchant-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(json.message || "تعذر إرسال الطلب");
      return;
    }

    formElement.reset();
    setWingId("");
    setCountryId("");
    setGovernorateId("");
    setCityId("");
    setSubmittedApplication({ id: json.data.application.id, storeName: json.data.application.storeName });
    setMessage(mode === "independent_store" ? "✓ تم إرسال طلب إضافة متجر/نشاط مستقل. ستراجع الإدارة وثائق النشاط الجديد ثم يصلك العقد المستقل." : "✓ تم إرسال طلب فتح المتجر بنجاح. ستقوم الإدارة بمراجعته، وعند إرسال العقد للتوقيع سيصلك تنبيه داخل حسابك.");
  }

  return (
    <div className="space-y-7">
      {mode === "independent_store" ? <div className="onboarding-surface rounded-3xl border-blue-200 bg-blue-50/85 p-5 text-right text-sm font-bold leading-7 text-blue-900">هذا طلب متجر أو نشاط مستقل تحت حسابك الحالي، وليس فرعاً تابعاً لنفس النشاط. ستعاد استخدام هوية التاجر المعتمدة، بينما يراجع الأدمن السجل والبطاقة الضريبية الخاصة بالنشاط الجديد. الموقع أدناه هو <b>الموقع التشغيلي للمتجر</b>، ويمكن أن يكون في تعز حتى لو كنت تقيم في صنعاء.</div> : null}
      <ApplicationSteps independentStore={mode === "independent_store"} />
      {submittedApplication ? (
        <div className="onboarding-surface rounded-[2rem] border-emerald-200 bg-emerald-50 p-6 text-right">
          <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-600" />
          <h2 className="text-2xl font-black text-emerald-950">تم إرسال الطلب بنجاح</h2>
          <p className="mt-2 text-sm leading-7 text-emerald-800">طلب متجر {submittedApplication.storeName} وصل إلى الإدارة. يمكنك متابعة حالته من صفحة المتابعة.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild><Link href={`/apply-store/${submittedApplication.id}`}>متابعة حالة الطلب</Link></Button>
            <Button asChild variant="outline"><Link href="/notifications">فتح التنبيهات</Link></Button>
          </div>
        </div>
      ) : null}
    <form onSubmit={submit} className="onboarding-form grid gap-5 rounded-[2rem] p-6 md:grid-cols-2 md:p-7">
      <div className="md:col-span-2">
        <p className="text-xs font-black uppercase tracking-[.18em] text-blue-600">المرحلة الأولى</p>
        <h2 className="mt-1 text-xl font-black text-slate-950">بيانات النشاط وموقع التشغيل</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">استخدم بيانات دقيقة؛ ستظهر لفريق المراجعة وتساعده على إعداد العقد ومسار التفعيل الصحيح.</p>
      </div>
      <Field label="اسم مقدم الطلب" name="applicantName" required defaultValue={currentUser?.fullName} />
      <Field label="البريد الإلكتروني" name="applicantEmail" type="email" required defaultValue={currentUser?.email} />
      <Field label="رقم الجوال" name="applicantPhone" />
      <Field label={mode === "independent_store" ? "اسم المتجر/العلامة المستقلة" : "اسم المتجر"} name="storeName" required />
      <div className="space-y-2">
        <Label htmlFor="wingId">الجناح / قطاع النشاط</Label>
        <select id="wingId" name="wingId" required value={wingId} onChange={(event) => setWingId(event.target.value)} className="onboarding-select h-11 w-full rounded-xl border px-4 text-sm">
          <option value="">اختر الجناح</option>
          {wings.map((wing) => <option key={wing.id} value={wing.id}>{wing.name}</option>)}
        </select>
        <p className="text-xs font-bold leading-5 text-slate-500">اختيار الجناح هو اختيار القطاع نفسه: يربط النظام المتجر تلقائياً بقالب تجهيز هذا الجناح، ولا يوجد اختيار ثانٍ للقطاع.</p>
      </div>
      <Field label="وصف النشاط التجاري" name="businessActivity" required placeholder="مثال: أدوات صيد بحرية ومستلزمات رحلات" />

      <div className="space-y-2">
        <Label htmlFor="countryId">دولة موقع المتجر التشغيلي</Label>
        <select
          id="countryId"
          name="countryId"
          value={countryId}
          onChange={(event) => {
            setCountryId(event.target.value);
            setGovernorateId("");
            setCityId("");
          }}
          className="onboarding-select h-11 w-full rounded-xl border px-4 text-sm"
        >
          <option value="">اختر الدولة</option>
          {countries.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="governorateId">محافظة موقع المتجر</Label>
        <select
          id="governorateId"
          name="governorateId"
          value={governorateId}
          onChange={(event) => {
            setGovernorateId(event.target.value);
            setCityId("");
          }}
          className="onboarding-select h-11 w-full rounded-xl border px-4 text-sm"
        >
          <option value="">اختر المحافظة</option>
          {filteredGovernorates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cityId">مدينة موقع المتجر</Label>
        <select id="cityId" name="cityId" value={cityId} onChange={(event) => setCityId(event.target.value)} className="onboarding-select h-11 w-full rounded-xl border px-4 text-sm">
          <option value="">اختر المدينة</option>
          {filteredCities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="districtId">المنطقة</Label>
        <select id="districtId" name="districtId" className="onboarding-select h-11 w-full rounded-xl border px-4 text-sm">
          <option value="">اختر المنطقة</option>
          {filteredDistricts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="description">وصف المتجر</Label>
        <Textarea id="description" name="description" placeholder="اكتب وصفاً مختصراً عن نشاط المتجر وخدماته" />
      </div>

      <Field label="واتساب" name="whatsapp" />
      <Field label="فيسبوك" name="facebook" />
      <Field label="إنستغرام" name="instagram" />

      <div className="flex items-center gap-3 md:col-span-2">
        <Button disabled={loading}>{loading ? "جارٍ الإرسال..." : "إرسال الطلب"}</Button>
        {message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}
      </div>
    </form>
    </div>
  );
}

function ApplicationSteps({ independentStore = false }: { independentStore?: boolean }) {
  const steps = [
    { title: "بيانات الطلب", text: independentStore ? "املأ بيانات النشاط المستقل وموقع تشغيله." : "املأ بيانات المتجر والنشاط والموقع.", icon: ClipboardCheck },
    { title: "مراجعة الإدارة", text: "الإدارة تراجع البيانات وتطلب تعديلات إن لزم.", icon: ShieldCheck },
    { title: "العقد", text: "يظهر العقد فقط بعد إرساله للتوقيع.", icon: FileSignature },
    { title: "التفعيل", text: "بعد التوقيع والموافقة النهائية يفتح المتجر.", icon: Store }
  ];
  return <div className="grid gap-3 md:grid-cols-4">{steps.map((step, index) => { const Icon = step.icon; return <div key={step.title} className="onboarding-step rounded-3xl p-4 text-right"><div className="onboarding-step-icon mb-3 inline-grid h-10 w-10 place-items-center rounded-2xl"><Icon className="h-5 w-5" /></div><p className="text-xs font-black text-slate-600">خطوة {index + 1}</p><h3 className="mt-1 font-black text-slate-950">{step.title}</h3><p className="mt-1 text-xs leading-6 text-slate-500">{step.text}</p></div>; })}</div>;
}

function Field({ label, name, type = "text", required = false, placeholder, defaultValue }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} />
    </div>
  );
}
