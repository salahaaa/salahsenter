"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VisibilityScheduleEditor, parseVisibilityScheduleFromForm } from "@/components/admin/visibility-schedule-editor";

function toDatetimeLocal(value?: Date | string | null) { if (!value) return ""; const d = new Date(value); return Number.isFinite(d.getTime()) ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16) : ""; }
function key() { return globalThis.crypto?.randomUUID?.() || `admin_dissolve_${Date.now()}_${Math.random().toString(36).slice(2)}`; }

export function AdminStoreOfferActions({ offerId, status, startsAt, endsAt, visibilitySchedule, bundleRemainingQuantity = 0 }: { offerId: string; status: string; startsAt?: Date | string | null; endsAt?: Date | string | null; visibilitySchedule?: unknown; bundleRemainingQuantity?: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showDissolve, setShowDissolve] = useState(false);
  const [quantity, setQuantity] = useState(bundleRemainingQuantity || 0);
  async function update(action: "approve_homepage" | "reject_homepage" | "pause") {
    const adminNote = action === "reject_homepage" ? window.prompt("سبب الرفض الذي سيظهر للتاجر:") || "" : undefined;
    if (action === "reject_homepage" && !adminNote?.trim()) return;
    setLoading(action);
    await fetch(`/api/admin/store-offers/${offerId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, adminNote }) });
    setLoading(null);
    router.refresh();
  }
  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    setLoading("schedule");
    await fetch(`/api/admin/store-offers/${offerId}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startsAt: f.get("startsAt") ? new Date(String(f.get("startsAt"))).toISOString() : null, endsAt: f.get("endsAt") ? new Date(String(f.get("endsAt"))).toISOString() : null, visibilitySchedule: parseVisibilityScheduleFromForm(f.get("visibilitySchedule")) }) });
    setLoading(null); setEditing(false); router.refresh();
  }
  async function dissolve(mode: "full" | "partial") {
    const q = mode === "full" ? bundleRemainingQuantity : Math.max(1, Math.min(bundleRemainingQuantity, Number(quantity || 1)));
    if (!window.confirm(`تفكيك ${q} باقة وإعادة المخزون؟`)) return;
    setLoading("dissolve");
    await fetch(`/api/admin/store-offers/${offerId}/dissolve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, quantity: q, idempotencyKey: key(), note: "Admin bundle dissolve" }) });
    setLoading(null); router.refresh();
  }
  async function remove() { if (!window.confirm("حذف العرض نهائياً؟")) return; setLoading("delete"); await fetch(`/api/admin/store-offers/${offerId}/status`, { method: "DELETE" }); setLoading(null); router.refresh(); }
  return <div className="space-y-2"><div className="flex flex-wrap gap-2"><Button size="sm" disabled={Boolean(loading) || status !== "pending_review"} onClick={() => update("approve_homepage")}>اعتماد نشر الرئيسية</Button><Button size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => update("pause")}>إيقاف</Button><Button size="sm" variant="destructive" disabled={Boolean(loading) || status !== "pending_review"} onClick={() => update("reject_homepage")}>رفض مع السبب</Button><Button size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => setEditing((v)=>!v)}>جدولة/تعديل</Button>{bundleRemainingQuantity > 0 ? <Button size="sm" variant="secondary" disabled={Boolean(loading)} onClick={()=>setShowDissolve(v=>!v)}>تفكيك المخزون</Button> : null}<Button size="sm" variant="destructive" disabled={Boolean(loading)} onClick={remove}>حذف</Button></div>{showDissolve ? <div className="grid gap-2 rounded-2xl border bg-amber-50 p-3 text-xs font-bold text-amber-900"><p>المتبقي: {bundleRemainingQuantity} باقة</p><div className="flex flex-wrap gap-2"><Input type="number" min={1} max={bundleRemainingQuantity} value={quantity||1} onChange={(e)=>setQuantity(Number(e.target.value||1))} className="h-9 w-28"/><Button type="button" size="sm" variant="outline" onClick={()=>dissolve("partial")}>تفكيك كمية</Button><Button type="button" size="sm" onClick={()=>dissolve("full")}>تفكيك كامل</Button></div></div> : null}{editing ? <form onSubmit={saveSchedule} className="mt-2 grid gap-3 rounded-2xl border bg-slate-50 p-3 md:grid-cols-2"><div className="space-y-2"><Label>بداية العرض</Label><Input name="startsAt" type="datetime-local" defaultValue={toDatetimeLocal(startsAt)} /></div><div className="space-y-2"><Label>نهاية العرض</Label><Input name="endsAt" type="datetime-local" defaultValue={toDatetimeLocal(endsAt)} /></div><VisibilityScheduleEditor defaultValue={visibilitySchedule} /><div className="md:col-span-2"><Button size="sm" disabled={Boolean(loading)}>حفظ الجدولة</Button></div></form> : null}</div>;
}

export function AdminPromotionalOfferActions({ offerId, status, startsAt, endsAt, visibilitySchedule }: { offerId: string; status: string; startsAt?: Date | string | null; endsAt?: Date | string | null; visibilitySchedule?: unknown }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  async function patch(nextStatus: string) { setLoading(nextStatus); await fetch(`/api/admin/promotional-offers/${offerId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) }); setLoading(null); router.refresh(); }
  async function saveSchedule(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const f = new FormData(event.currentTarget); setLoading("schedule"); await fetch(`/api/admin/promotional-offers/${offerId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startsAt: f.get("startsAt") ? new Date(String(f.get("startsAt"))).toISOString() : null, endsAt: f.get("endsAt") ? new Date(String(f.get("endsAt"))).toISOString() : null, visibilitySchedule: parseVisibilityScheduleFromForm(f.get("visibilitySchedule")) }) }); setLoading(null); setEditing(false); router.refresh(); }
  async function remove() { if (!window.confirm("حذف عرض الإدارة؟")) return; setLoading("delete"); await fetch(`/api/admin/promotional-offers/${offerId}`, { method: "DELETE" }); setLoading(null); router.refresh(); }
  return <div className="space-y-2"><div className="flex flex-wrap gap-2"><Button size="sm" disabled={Boolean(loading)} onClick={() => patch("active")}>تفعيل</Button><Button size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => patch("disabled")}>إيقاف</Button><Button size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => setEditing((v)=>!v)}>جدولة/تعديل</Button><Button size="sm" variant="destructive" disabled={Boolean(loading)} onClick={remove}>حذف</Button></div>{editing ? <form onSubmit={saveSchedule} className="mt-2 grid gap-3 rounded-2xl border bg-slate-50 p-3 md:grid-cols-2"><div className="space-y-2"><Label>بداية الظهور</Label><Input name="startsAt" type="datetime-local" defaultValue={toDatetimeLocal(startsAt)} /></div><div className="space-y-2"><Label>نهاية الظهور</Label><Input name="endsAt" type="datetime-local" defaultValue={toDatetimeLocal(endsAt)} /></div><VisibilityScheduleEditor defaultValue={visibilitySchedule} /><div className="md:col-span-2"><Button size="sm" disabled={Boolean(loading)}>حفظ الجدولة</Button></div></form> : null}</div>;
}
