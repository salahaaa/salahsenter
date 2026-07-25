"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveEffectivePermission, type PermissionOverrideEffect, type PermissionPresentationState } from "@/lib/employees/policy";

type Permission = { id: string; code: string; name: string; group: string; description: string | null };
type Group = { id: string; name: string; description: string | null };
type Employee = { id: string; userId: string; fullName: string; email: string; username: string | null; avatarUrl: string | null; jobTitle: string | null; status: string; groupRoleId: string | null; inheritedPermissionCodes: string[]; overrides: Record<string, PermissionOverrideEffect> };

type Scope = "platform" | "store";

function stateLabel(value: PermissionPresentationState) {
  return value === "grant" ? "منح مباشر" : value === "deny" ? "سحب / منع" : "وراثة الدور";
}

/** Separate permission administration workspace with role inheritance and individual grant/deny overrides. */
export function EmployeePermissionManagementPanel({ scope, storeId, employees, permissions, groups }: { scope: Scope; storeId?: string; employees: Employee[]; permissions: Permission[]; groups: Group[] }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || "");
  const employee = employees.find((item) => item.id === employeeId) || null;
  const [groupRoleId, setGroupRoleId] = useState("");
  const [overrides, setOverrides] = useState<Record<string, PermissionOverrideEffect>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const endpoint = scope === "platform" ? "/api/admin/permissions-management" : "/api/merchant/permissions-management";
  const grouped = useMemo(() => permissions.reduce<Record<string, Permission[]>>((result, permission) => { (result[permission.group || "عام"] ||= []).push(permission); return result; }, {}), [permissions]);

  useEffect(() => {
    setGroupRoleId(employee?.groupRoleId || "");
    setOverrides(employee?.overrides || {});
    setMessage(null);
  }, [employeeId, employee]);

  function stateFor(permission: Permission): PermissionPresentationState {
    return overrides[permission.code] || "inherit";
  }

  function updateState(code: string, state: PermissionPresentationState) {
    setOverrides((current) => {
      const next = { ...current };
      if (state === "inherit") delete next[code];
      else next[code] = state;
      return next;
    });
  }

  function selectGroupState(groupPermissions: Permission[], state: PermissionPresentationState) {
    setOverrides((current) => {
      const next = { ...current };
      for (const permission of groupPermissions) {
        if (state === "inherit") delete next[permission.code];
        else next[permission.code] = state;
      }
      return next;
    });
  }

  async function save() {
    if (!employee) return;
    setSaving(true);
    try {
      const overridesPayload = permissions.map((permission) => ({ code: permission.code, effect: stateFor(permission) })).filter((item) => item.effect !== "inherit");
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, employeeId: employee.id, groupRoleId: groupRoleId || null, overrides: overridesPayload })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || "تعذر حفظ الصلاحيات");
      setMessage(json.data?.message || "تم حفظ الصلاحيات");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حفظ الصلاحيات");
    } finally {
      setSaving(false);
    }
  }

  const inherited = new Set(employee?.inheritedPermissionCodes || []);
  const effectiveCount = permissions.filter((permission) => resolveEffectivePermission({ inherited: inherited.has(permission.code), override: overrides[permission.code] })).length;
  const grantCount = Object.values(overrides).filter((effect) => effect === "grant").length;
  const denyCount = Object.values(overrides).filter((effect) => effect === "deny").length;

  return <div className="space-y-6">
    <section className="rounded-3xl border bg-white p-6 shadow-card">
      <div className="mb-5"><h2 className="text-xl font-black text-slate-950">إدارة الصلاحيات المستقلة</h2><p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">اختر موظفاً ثم امنح أو امنع كل عملية. <b>الوراثة</b> تعني صلاحية الدور فقط، <b>المنح المباشر</b> يضيف صلاحية للموظف، و<b>السحب</b> يلغي صلاحية حتى لو منحها الدور. جميع صلاحيات التاجر أدناه مقيّدة بالمتجر المحدد.</p></div>
      {!employees.length ? <p className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">أنشئ موظفاً أولاً من شاشة الموظفين. الحساب الجديد يبدأ دون صلاحيات.</p> : <><div className="grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-2"><div className="space-y-2"><label className="text-sm font-black">الموظف</label><select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">اختر الموظف</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.fullName} — {item.username || item.email}</option>)}</select></div><div className="space-y-2"><label className="text-sm font-black">دور / مجموعة اختيارية</label><select value={groupRoleId} onChange={(event) => setGroupRoleId(event.target.value)} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">بدون دور موروث</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><p className="text-xs text-slate-500">يمكن بناء الأدوار من صفحة الأدوار، ثم استخدام التجاوزات أدناه لحالة كل موظف.</p></div></div>
      <div className="mt-4 flex flex-wrap gap-2"><Badge variant="success">فعّال الآن: {effectiveCount}</Badge><Badge variant="outline">منح مباشر: {grantCount}</Badge><Badge variant={denyCount ? "danger" : "outline"}>سحب مباشر: {denyCount}</Badge>{employee?.status !== "active" ? <Badge variant="warning">حساب الموظف غير نشط؛ الصلاحيات محفوظة ولكن لا يمكنه الدخول</Badge> : null}</div>
      {message ? <p className="mt-4 rounded-xl border bg-white p-3 text-sm font-bold text-slate-700">{message}</p> : null}</>}
    </section>

    {employee ? <section className="space-y-5">{Object.entries(grouped).map(([group, items]) => <article key={group} className="rounded-3xl border bg-white p-5 shadow-card"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-950">{group}</h3><p className="mt-1 text-xs text-slate-500">كل عملية مستقلة؛ استخدم السحب المباشر لإبطال صلاحية موروثة من الدور.</p></div><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => selectGroupState(items, "grant")}>منح الكل</Button><Button type="button" size="sm" variant="outline" onClick={() => selectGroupState(items, "deny")}>سحب الكل</Button><Button type="button" size="sm" variant="outline" onClick={() => selectGroupState(items, "inherit")}>إعادة للوراثة</Button></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map((permission) => { const state = stateFor(permission); const effective = resolveEffectivePermission({ inherited: inherited.has(permission.code), override: overrides[permission.code] }); return <div key={permission.code} className={`rounded-2xl border p-4 ${effective ? "border-emerald-200 bg-emerald-50/50" : "bg-slate-50"}`}><div className="flex gap-2"><div className="min-w-0 flex-1"><div className="font-black text-slate-950">{permission.name}</div><div className="mt-1 text-xs leading-5 text-slate-500">{permission.description || permission.code}</div><code className="mt-2 block text-[10px] text-slate-400">{permission.code}</code></div><Badge variant={effective ? "success" : "outline"}>{effective ? "مسموح" : "غير مسموح"}</Badge></div><label className="mt-3 block text-xs font-bold text-slate-600">مصدر القرار<select value={state} onChange={(event) => updateState(permission.code, event.target.value as PermissionPresentationState)} className="mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm"><option value="inherit">{stateLabel("inherit")}{inherited.has(permission.code) ? " — مسموح من الدور" : " — لا توجد صلاحية"}</option><option value="grant">{stateLabel("grant")}</option><option value="deny">{stateLabel("deny")}</option></select></label></div>; })}</div></article>)}</section> : null}
    {employee ? <div className="sticky bottom-4 z-10 rounded-2xl border bg-white/95 p-4 shadow-card backdrop-blur"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-bold text-slate-600">سيتم تدقيق التغيير باسم المستخدم الحالي مع القيم قبل وبعد التعديل.</p><Button disabled={saving} onClick={save}>{saving ? "جارٍ الحفظ..." : "حفظ الصلاحيات"}</Button></div></div> : null}
  </div>;
}
