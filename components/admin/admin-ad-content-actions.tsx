"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VisibilityScheduleEditor, parseVisibilityScheduleFromForm } from "@/components/admin/visibility-schedule-editor";

function toDatetimeLocal(value?: Date | string | null) { if (!value) return ""; const d = new Date(value); return Number.isFinite(d.getTime()) ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16) : ""; }

export function AdminAdContentActions({ id, kind, status, startAt, endAt, visibilitySchedule }: { id: string; kind: "banner" | "announcement"; status: string; startAt?: Date | string | null; endAt?: Date | string | null; visibilitySchedule?: unknown }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const endpoint = kind === "banner" ? `/api/admin/banners/${id}` : `/api/admin/announcements/${id}`;
  async function patch(payload: Record<string, unknown>) { setLoading("patch"); await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); setLoading(null); router.refresh(); }
  async function remove() { if (!window.confirm("تعطيل/حذف هذا المحتوى؟")) return; setLoading("delete"); await fetch(endpoint, { method: "DELETE" }); setLoading(null); router.refresh(); }
  async function saveSchedule(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const f = new FormData(event.currentTarget); await patch({ startAt: f.get("startAt") ? new Date(String(f.get("startAt"))).toISOString() : null, endAt: f.get("endAt") ? new Date(String(f.get("endAt"))).toISOString() : null, visibilitySchedule: parseVisibilityScheduleFromForm(f.get("visibilitySchedule")) }); setEditing(false); }
  return <div className="mt-3 space-y-2"><div className="flex flex-wrap gap-2"><Button type="button" size="sm" disabled={Boolean(loading)} onClick={() => patch({ status: "active" })}>تفعيل</Button><Button type="button" size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => patch({ status: "disabled" })}>إيقاف</Button><Button type="button" size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => setEditing((v)=>!v)}>جدولة</Button><Button type="button" size="sm" variant="destructive" disabled={Boolean(loading)} onClick={remove}>حذف</Button></div>{editing ? <form onSubmit={saveSchedule} className="grid gap-3 rounded-2xl border bg-slate-50 p-3 md:grid-cols-2"><div className="space-y-2"><Label>بداية الظهور</Label><Input name="startAt" type="datetime-local" defaultValue={toDatetimeLocal(startAt)} /></div><div className="space-y-2"><Label>نهاية الظهور</Label><Input name="endAt" type="datetime-local" defaultValue={toDatetimeLocal(endAt)} /></div><VisibilityScheduleEditor defaultValue={visibilitySchedule} /><div className="md:col-span-2"><Button size="sm">حفظ الجدولة</Button></div></form> : null}</div>;
}
