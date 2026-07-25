"use client";

import { useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PlatformSecuritySettings } from "@/lib/security-settings";

export function SecurityControlPanel({ initial }: { initial: PlatformSecuritySettings }) {
  const [settings, setSettings] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof PlatformSecuritySettings>(key: K, value: PlatformSecuritySettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function updateModule(key: keyof PlatformSecuritySettings["disabledModules"], value: boolean) {
    setSettings((prev) => ({ ...prev, disabledModules: { ...prev.disabledModules, [key]: value } }));
  }

  async function save(payload = settings) {
    setLoading(true);
    const response = await fetch("/api/admin/security/emergency", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? `✓ ${json.data?.message || json.message || "تم الحفظ"}` : json.message || "تعذر الحفظ");
    if (response.ok) setSettings(json.data.settings);
  }

  async function stopNow() {
    if (!window.confirm("سيتم إيقاف المنصة فوراً أمام العملاء والتجار. هل أنت متأكد؟")) return;
    await save({ ...settings, emergencyLockdown: true, maintenanceMode: true, securityLevel: "lockdown" });
  }

  async function resume() {
    if (!window.confirm("هل تريد إعادة تشغيل المنصة؟")) return;
    setLoading(true);
    const response = await fetch("/api/admin/security/emergency", { method: "DELETE" });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? "✓ تم إعادة تشغيل المنصة" : json.message || "تعذر التشغيل");
    if (response.ok) setSettings(json.data.settings);
  }

  const locked = settings.emergencyLockdown || settings.maintenanceMode || settings.securityLevel === "lockdown";

  return (
    <div className="space-y-6">
      <section className={`rounded-[2rem] border p-6 shadow-card ${locked ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <div className={`mb-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black ${locked ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
              {locked ? <ShieldAlert className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              {locked ? "المنصة متوقفة" : "المنصة تعمل"}
            </div>
            <h2 className="text-2xl font-black text-slate-950">زر الطوارئ والتحكم الأمني</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">استخدم زر الإيقاف فقط عند وجود اختراق أو خلل حرج أو عملية صيانة طارئة.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="destructive" size="lg" onClick={stopNow} disabled={loading}>إيقاف المنصة فوراً</Button>
            <Button variant="secondary" size="lg" onClick={resume} disabled={loading}>إعادة تشغيل المنصة</Button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-card">
        <h3 className="mb-5 text-xl font-black">إعدادات رسالة الإيقاف</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>عنوان الرسالة</Label><Input value={settings.messageTitle} onChange={(e) => update("messageTitle", e.target.value)} /></div>
          <div className="space-y-2"><Label>مستوى الحماية</Label><select value={settings.securityLevel} onChange={(e) => update("securityLevel", e.target.value as PlatformSecuritySettings["securityLevel"])} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="normal">طبيعي</option><option value="heightened">مراقبة مشددة</option><option value="lockdown">إغلاق كامل</option></select></div>
          <div className="space-y-2 md:col-span-2"><Label>نص الرسالة للزوار</Label><Textarea value={settings.messageBody} onChange={(e) => update("messageBody", e.target.value)} /></div>
          <div className="space-y-2 md:col-span-2"><Label>سبب الإيقاف الداخلي</Label><Textarea value={settings.reason} onChange={(e) => update("reason", e.target.value)} /></div>
        </div>
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-card">
        <h3 className="mb-5 text-xl font-black">إيقاف وحدات محددة بدون إيقاف كامل</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle label="إيقاف استقبال الطلبات" checked={settings.disabledModules.orders} onChange={(v) => updateModule("orders", v)} />
          <Toggle label="إيقاف طلبات فتح المتاجر" checked={settings.disabledModules.merchantApplications} onChange={(v) => updateModule("merchantApplications", v)} />
          <Toggle label="إيقاف رفع الملفات" checked={settings.disabledModules.uploads} onChange={(v) => updateModule("uploads", v)} />
          <Toggle label="إيقاف التسجيلات الجديدة" checked={settings.disabledModules.registrations} onChange={(v) => updateModule("registrations", v)} />
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-2xl border bg-white/95 p-4 shadow-soft backdrop-blur">
        <Button onClick={() => save()} disabled={loading}>حفظ إعدادات الحماية</Button>
        {message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between rounded-2xl border bg-slate-50 p-4 text-sm font-bold"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></label>;
}
