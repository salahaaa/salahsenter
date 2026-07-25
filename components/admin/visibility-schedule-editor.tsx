"use client";

import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { VisibilitySchedule, VisibilityScheduleMode } from "@/lib/visibility-schedule";
import { normalizeVisibilitySchedule } from "@/lib/visibility-schedule";

const weekDays = [
  { id: 0, label: "الأحد" },
  { id: 1, label: "الإثنين" },
  { id: 2, label: "الثلاثاء" },
  { id: 3, label: "الأربعاء" },
  { id: 4, label: "الخميس" },
  { id: 5, label: "الجمعة" },
  { id: 6, label: "السبت" }
];

export function VisibilityScheduleEditor({ name = "visibilitySchedule", defaultValue, title = "جدولة الظهور" }: { name?: string; defaultValue?: unknown; title?: string }) {
  const initial = normalizeVisibilitySchedule(defaultValue);
  const [mode, setMode] = useState<VisibilityScheduleMode>(initial.mode || "always");
  const [timezone, setTimezone] = useState(initial.timezone || "Asia/Aden");
  const [startDate, setStartDate] = useState(initial.startDate || "");
  const [endDate, setEndDate] = useState(initial.endDate || "");
  const [startTime, setStartTime] = useState(initial.startTime || "");
  const [endTime, setEndTime] = useState(initial.endTime || "");
  const [selectedDays, setSelectedDays] = useState<number[]>(initial.weekDays || []);
  const [slotsText, setSlotsText] = useState((initial.slots || []).map((slot) => `${slot.date || `weekday:${slot.weekday ?? ""}`} ${slot.startTime}-${slot.endTime}`).join("\n"));

  function toggleDay(day: number) {
    setSelectedDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort());
  }

  const schedule = useMemo<VisibilitySchedule>(() => {
    const slots = slotsText.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
      const [left, range] = line.split(/\s+/, 2);
      const [a, b] = (range || "").split("-");
      if (left?.startsWith("weekday:")) return { weekday: Number(left.replace("weekday:", "")), startTime: a, endTime: b };
      return { date: left, startTime: a, endTime: b };
    }).filter((slot) => slot.startTime && slot.endTime);
    return { mode, timezone, startDate: startDate || null, endDate: endDate || null, startTime: startTime || null, endTime: endTime || null, weekDays: selectedDays, slots };
  }, [mode, timezone, startDate, endDate, startTime, endTime, selectedDays, slotsText]);

  return (
    <section className="rounded-2xl border bg-slate-50 p-4 md:col-span-2">
      <input type="hidden" name={name} value={JSON.stringify(schedule)} />
      <div className="mb-3"><h3 className="font-black text-slate-950">{title}</h3><p className="mt-1 text-xs font-bold text-slate-500">تحكم احترافي: دائماً، نطاق تاريخ، ساعات يومية، أيام أسبوع، أو فتحات مخصصة.</p></div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-2"><Label>وضع الظهور</Label><select value={mode} onChange={(event) => setMode(event.target.value as VisibilityScheduleMode)} className="h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="always">دائماً ضمن تاريخ البداية/النهاية</option><option value="date_range">نطاق تاريخ فقط</option><option value="daily_window">ساعات يومية</option><option value="weekly_window">أيام أسبوع + ساعات</option><option value="custom_slots">فتحات مخصصة</option></select></div>
        <div className="space-y-2"><Label>المنطقة الزمنية</Label><Input value={timezone} onChange={(e) => setTimezone(e.target.value)} /></div>
        <div className="space-y-2"><Label>ملاحظة</Label><div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-500">Asia/Aden مناسبة لليمن</div></div>
        {mode !== "always" ? <><div className="space-y-2"><Label>تاريخ البداية</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div><div className="space-y-2"><Label>تاريخ النهاية</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div></> : null}
        {["daily_window", "weekly_window"].includes(mode) ? <><div className="space-y-2"><Label>وقت البداية</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div><div className="space-y-2"><Label>وقت النهاية</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div></> : null}
        {mode === "weekly_window" ? <div className="space-y-2 md:col-span-3"><Label>أيام الظهور</Label><div className="flex flex-wrap gap-2">{weekDays.map((day) => <button type="button" key={day.id} onClick={() => toggleDay(day.id)} className={`rounded-full border px-3 py-2 text-xs font-black ${selectedDays.includes(day.id) ? "border-blue-300 bg-blue-50 text-blue-700" : "bg-white text-slate-600"}`}>{day.label}</button>)}</div></div> : null}
        {mode === "custom_slots" ? <div className="space-y-2 md:col-span-3"><Label>فتحات مخصصة</Label><textarea value={slotsText} onChange={(e) => setSlotsText(e.target.value)} className="min-h-24 w-full rounded-xl border bg-white p-3 text-sm" placeholder={"2026-07-05 09:00-12:00\nweekday:1 16:00-18:00"} /></div> : null}
      </div>
    </section>
  );
}

export function parseVisibilityScheduleFromForm(value: FormDataEntryValue | null) {
  if (!value) return {};
  try { return JSON.parse(String(value)); } catch { return {}; }
}
