"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExperiencePreviewButton } from "@/components/admin/experience/experience-preview-button";

const defaults = {
  fontPrimary: "system-ui",
  fontSecondary: "system-ui",
  textColor: "#0f172a",
  primaryColor: "#2563eb",
  secondaryColor: "#f1f5f9",
  backgroundColor: "#f8fafc",
  cardColor: "#ffffff",
  borderColor: "#e2e8f0",
  successColor: "#10b981",
  warningColor: "#f59e0b",
  dangerColor: "#ef4444",
  radius: "16px",
  shadow: "0 12px 35px rgba(15,23,42,.08)",
  spacing: "16px",
  darkMode: false
};

export function ThemeBuilderForm({ initial }: { initial: Record<string, unknown> }) {
  const [theme, setTheme] = useState<Record<string, unknown>>({ ...defaults, ...initial });
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/theme", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: theme, isPublic: true }) });
    const data = await response.json();
    setMessage(response.ok ? "✓ تم حفظ الهوية البصرية" : data.message || "تعذر الحفظ");
  }
  function set(key: string, value: unknown) { setTheme((prev) => ({ ...prev, [key]: value })); }
  const colorKeys = ["textColor", "primaryColor", "secondaryColor", "backgroundColor", "cardColor", "borderColor", "successColor", "warningColor", "dangerColor"];
  return <form onSubmit={submit} className="rounded-3xl border bg-white p-6 shadow-card"><div className="mb-5 rounded-3xl p-5" style={{ background: String(theme.backgroundColor || "#f8fafc"), color: String(theme.textColor || "#0f172a"), borderRadius: String(theme.radius || "16px"), boxShadow: String(theme.shadow || "0 12px 35px rgba(15,23,42,.08)") }}><p className="text-xs font-black opacity-70">معاينة الثيم الحية</p><h3 className="mt-2 text-2xl font-black">عنوان المنصة والبطاقات</h3><p className="mt-2 text-sm opacity-80">تظهر الألوان والخطوط ونصف القطر والظل في المعاينة قبل الحفظ.</p><span className="mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-black text-white" style={{ background: String(theme.primaryColor || "#2563eb") }}>زر أساسي</span></div><div className="grid gap-4 md:grid-cols-3"><Field label="الخط الأساسي" value={String(theme.fontPrimary)} onChange={(v) => set("fontPrimary", v)} /><Field label="الخط الثانوي" value={String(theme.fontSecondary)} onChange={(v) => set("fontSecondary", v)} /><Field label="Border Radius" value={String(theme.radius)} onChange={(v) => set("radius", v)} />{colorKeys.map((key) => <Color key={key} label={key} value={String(theme[key])} onChange={(v) => set(key, v)} />)}<Field label="Shadow" value={String(theme.shadow)} onChange={(v) => set("shadow", v)} /><Field label="Spacing" value={String(theme.spacing)} onChange={(v) => set("spacing", v)} /><label className="flex items-center gap-2 rounded-xl border bg-slate-50 p-3 text-sm font-bold"><input type="checkbox" checked={Boolean(theme.darkMode)} onChange={(e) => set("darkMode", e.target.checked)} /> حفظ تفضيل المظهر الداكن (لا يفرض وضعاً داكناً على الصفحات الحالية)</label></div><div className="mt-4 flex flex-wrap items-center gap-3"><ExperiencePreviewButton scope="theme" payload={theme}/><Button>نشر الثيم</Button>{message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}</div></form>;
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { return <div className="space-y-2"><Label>{label}</Label><Input value={value} onChange={(e) => onChange(e.target.value)} /></div>; }
function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { return <div className="space-y-2"><Label>{label}</Label><div className="flex gap-2"><Input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-16 p-1" /><Input value={value} onChange={(e) => onChange(e.target.value)} /></div></div>; }
