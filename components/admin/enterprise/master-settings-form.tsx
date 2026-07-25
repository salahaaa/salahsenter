"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const defaultSettings = {
  platform: { name: "صلاح سنتر", maintenanceMode: false, defaultCurrency: "YER" },
  mall: { featuredLimit: 12, allowPublicBrowsing: true },
  stores: { requireFinalApproval: true, allowMerchantNameEdit: false, allowStoreNumberEdit: false },
  contracts: { requireElectronicSignature: true, renewalReminderDays: 30 },
  commissions: { defaultRate: 5, settlementCycleDays: 15 },
  orders: { cancellationHours: 2, autoCloseAfterDeliveryDays: 7 },
  shipping: { enabled: true, defaultFee: 1000 },
  payment: { cashOnDelivery: true, onlinePayment: false },
  taxes: { enabled: false, defaultRate: 0 },
  notifications: { email: false, sms: false, push: false, inApp: true },
  security: { requireStrongPasswords: true, sessionDays: 7 },
  reports: { refreshMinutes: 15, exportEnabled: true }
};

export function MasterSettingsForm({ initial }: { initial: Record<string, unknown> }) {
  const [json, setJson] = useState(JSON.stringify(Object.keys(initial).length ? initial : defaultSettings, null, 2));
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(json); } catch { setMessage("JSON غير صحيح"); return; }
    setLoading(true);
    const settings = Object.entries(parsed).map(([group, value]) => ({ group: "master", key: group, value, isPublic: false }));
    const response = await fetch("/api/admin/master-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings }) });
    const data = await response.json();
    setLoading(false);
    setMessage(response.ok ? "✓ تم حفظ إعدادات الإدارة المركزية" : data.message || "تعذر الحفظ");
  }

  return <form onSubmit={submit} className="rounded-3xl border bg-white p-6 shadow-card"><Label htmlFor="masterSettings">إعدادات Enterprise Master JSON</Label><Textarea id="masterSettings" value={json} onChange={(e) => setJson(e.target.value)} className="mt-3 min-h-[520px] font-mono text-left ltr" dir="ltr" /><div className="mt-4 flex items-center gap-3"><Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div></form>;
}
