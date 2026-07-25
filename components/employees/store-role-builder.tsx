"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Permission = { code: string; name: string; group: string; description: string | null };
type Group = { id: string; name: string; description: string | null };

/** Merchant-side custom role creator. Roles remain optional; direct overrides are handled separately. */
export function StoreRoleBuilder({ storeId, permissions, groups }: { storeId: string; permissions: Permission[]; groups: Group[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(new Set<string>());
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const grouped = useMemo(() => permissions.reduce<Record<string, Permission[]>>((result, permission) => { (result[permission.group] ||= []).push(permission); return result; }, {}), [permissions]);

  function toggle(code: string) { setSelected((current) => { const next = new Set(current); next.has(code) ? next.delete(code) : next.add(code); return next; }); }
  function toggleGroup(items: Permission[]) { setSelected((current) => { const next = new Set(current); const allSelected = items.every((item) => next.has(item.code)); for (const item of items) allSelected ? next.delete(item.code) : next.add(item.code); return next; }); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const response = await fetch("/api/merchant/employees/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, name: form.get("name"), description: form.get("description") || undefined, permissionCodes: [...selected] }) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || "تعذر إنشاء الدور");
      setMessage("تم إنشاء الدور المخصص. يمكنك اختياره للموظف ثم إضافة التجاوزات الفردية.");
      setOpen(false);
      setSelected(new Set());
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر إنشاء الدور"); }
    finally { setSaving(false); }
  }

  return <section className="rounded-3xl border bg-white p-6 shadow-card"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-black text-slate-950">الأدوار المخصصة للمتجر</h2><p className="mt-1 text-sm text-slate-500">يمكنك بناء دور مثل موظف مبيعات أو مخزون أو طلبات ثم تعيينه للموظف من شاشة الصلاحيات. الدور لا يفرض أي صلاحية افتراضية على الحسابات الجديدة.</p></div><Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>{open ? "إخفاء منشئ الدور" : "+ إنشاء دور مخصص"}</Button></div>{groups.length ? <p className="mt-3 text-xs font-bold text-slate-500">الأدوار الحالية: {groups.map((group) => group.name).join("، ")}</p> : null}{message ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{message}</p> : null}{open ? <form onSubmit={submit} className="mt-5 rounded-2xl border bg-slate-50 p-4"><div className="grid gap-3 md:grid-cols-2"><Input name="name" required placeholder="مثال: موظف مبيعات" /><Input name="description" placeholder="وصف مختصر للدور" /></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Object.entries(grouped).map(([group, items]) => <div key={group} className="rounded-2xl border bg-white p-3"><div className="mb-2 flex items-center justify-between gap-2"><b className="text-sm">{group}</b><button type="button" onClick={() => toggleGroup(items)} className="text-xs font-black text-primary">تحديد/إلغاء الكل</button></div>{items.map((permission) => <label key={permission.code} className="mb-2 flex cursor-pointer items-start gap-2 rounded-xl bg-slate-50 p-2 text-xs font-bold"><input type="checkbox" checked={selected.has(permission.code)} onChange={() => toggle(permission.code)} /><span>{permission.name}</span></label>)}</div>)}</div><div className="mt-4 flex items-center gap-3"><Button disabled={saving}>{saving ? "جارٍ الحفظ..." : `إنشاء الدور (${selected.size} صلاحية)`}</Button></div></form> : null}</section>;
}
