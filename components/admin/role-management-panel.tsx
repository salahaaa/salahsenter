"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { isPlatformPermission } from "@/lib/permission-scopes";

type Role = { id: string; name: string; code: string; scope: "system" | "store"; description: string | null; isSystem: boolean };
type Permission = { id: string; name: string; code: string; group: string };
type Assignment = { roleId: string; permissionCode: string };

function scopeLabel(scope: "system" | "store") {
  return scope === "system" ? "منصة / أدمن" : "متجر / تاجر";
}

export function RoleManagementPanel({ roles, permissions, assignments }: { roles: Role[]; permissions: Permission[]; assignments: Assignment[] }) {
  const router = useRouter();
  const filteredRoles = useMemo(() => roles.filter((role) => role.scope === "system"), [roles]);
  const [selectedRoleId, setSelectedRoleId] = useState(filteredRoles[0]?.id || "");
  const selectedRole = roles.find((role) => role.id === selectedRoleId && role.scope === "system") || filteredRoles[0];
  const visiblePermissions = useMemo(() => permissions.filter((permission) => isPlatformPermission(permission.code)), [permissions]);
  const [checkedCodes, setCheckedCodes] = useState<Set<string>>(new Set());
  const [roleName, setRoleName] = useState(selectedRole?.name || "");
  const [roleDescription, setRoleDescription] = useState(selectedRole?.description || "");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const next = roles.find((role) => role.id === selectedRoleId && role.scope === "system") || filteredRoles[0];
    if (next && next.id !== selectedRoleId) setSelectedRoleId(next.id);
  }, [filteredRoles, roles, selectedRoleId]);

  useEffect(() => {
    if (!selectedRole) return;
    setCheckedCodes(new Set(assignments.filter((a) => a.roleId === selectedRole.id).map((a) => a.permissionCode).filter((code) => isPlatformPermission(code))));
    setRoleName(selectedRole.name);
    setRoleDescription(selectedRole.description || "");
  }, [assignments, selectedRole]);

  function selectRole(id: string) {
    setSelectedRoleId(id);
    setMessage(null);
  }

  function toggle(code: string) {
    setCheckedCodes((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  async function saveRole() {
    if (!selectedRole) return;
    const response = await fetch(`/api/admin/rbac/roles/${selectedRole.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: roleName, description: roleDescription, permissionCodes: [...checkedCodes] })
    });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم حفظ بيانات الدور والصلاحيات" : json.message || "تعذر الحفظ");
    if (response.ok) router.refresh();
  }

  async function stopRole() {
    if (!selectedRole) return;
    if (selectedRole.isSystem) return setMessage("لا يمكن تعطيل دور نظامي");
    if (!window.confirm(`سيتم تعطيل/حذف الدور (${selectedRole.name}) وإزالة ربطه من المستخدمين. هل تريد المتابعة؟`)) return;
    const response = await fetch(`/api/admin/rbac/roles/${selectedRole.id}`, { method: "DELETE" });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم تعطيل الدور وإزالة صلاحياته" : json.message || "تعذر تعطيل الدور");
    if (response.ok) router.refresh();
  }

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/admin/rbac/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        code: form.get("code"),
        scope: form.get("scope"),
        description: form.get("description") || undefined,
        permissionCodes: []
      })
    });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم إنشاء الدور. اختره من القائمة ثم امنحه الصلاحيات المطلوبة." : json.message || "تعذر إنشاء الدور");
    if (response.ok) { formElement.reset(); router.refresh(); }
  }

  const grouped = visiblePermissions.reduce<Record<string, Permission[]>>((acc, permission) => {
    acc[permission.group] ||= [];
    acc[permission.group].push(permission);
    return acc;
  }, {});

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <aside className="rounded-3xl border bg-white p-5 shadow-card">
        <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold leading-7 text-blue-900">هذه الشاشة مخصصة لصلاحيات المنصة وموظفي الإدارة فقط. صلاحيات موظفي المتاجر تُدار من لوحة التاجر داخل صفحة الموظفين والصلاحيات.</div>
        <h2 className="mb-4 text-xl font-black">الأدوار</h2>
        <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
          {filteredRoles.map((role) => (
            <button key={role.id} type="button" onClick={() => selectRole(role.id)} className={`w-full rounded-2xl border p-4 text-right transition ${role.id === selectedRole?.id ? "border-primary bg-blue-50" : "bg-white hover:bg-slate-50"}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-black">{role.name}</span><Badge variant="outline">{scopeLabel(role.scope)}</Badge></div>
              <p className="mt-1 text-xs text-slate-500">{role.code}</p>
              {role.isSystem ? <p className="mt-1 text-[11px] font-bold text-amber-600">دور نظامي محمي</p> : null}
            </button>
          ))}
          {!filteredRoles.length ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">لا توجد أدوار في هذا النطاق.</p> : null}
        </div>
        <form onSubmit={createRole} className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-4">
          <h3 className="font-black">إنشاء دور جديد</h3>
          <Input name="name" placeholder="اسم الدور" required />
          <Input name="code" placeholder="role_code" required />
          <input type="hidden" name="scope" value="system" />
          <div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-500">النطاق: System — صلاحيات منصة فقط</div>
          <Textarea name="description" placeholder="وصف" />
          <Button className="w-full">إنشاء بدون صلاحيات</Button>
        </form>
      </aside>

      <section className="rounded-3xl border bg-white p-6 shadow-card">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">{selectedRole ? `إدارة دور: ${selectedRole.name}` : "اختر دوراً"}</h2>
            <p className="mt-1 text-sm text-slate-500">تعرض هذه الشاشة صلاحيات المنصة فقط. صلاحيات المتجر تُدار من لوحة التاجر وليس من الإدارة.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={saveRole} disabled={!selectedRole}>حفظ</Button>
            <Button type="button" variant="outline" onClick={() => setCheckedCodes(new Set())} disabled={!selectedRole}>مسح الصلاحيات</Button>
            <Button type="button" variant="destructive" onClick={stopRole} disabled={!selectedRole || selectedRole.isSystem}>تعطيل الدور</Button>
          </div>
        </div>

        {selectedRole ? (
          <>
            <div className="mb-5 grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
              <div className="space-y-2"><Label>اسم الدور</Label><Input value={roleName} onChange={(e) => setRoleName(e.target.value)} disabled={selectedRole.isSystem && selectedRole.code === "super_admin"} /></div>
              <div className="space-y-2"><Label>الكود</Label><Input value={selectedRole.code} disabled /></div>
              <div className="space-y-2"><Label>النطاق</Label><Input value={scopeLabel(selectedRole.scope)} disabled /></div>
              <div className="space-y-2"><Label>عدد الصلاحيات المباشرة</Label><Input value={String(checkedCodes.size)} disabled /></div>
              <div className="space-y-2 md:col-span-2"><Label>الوصف</Label><Textarea value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} /></div>
            </div>

            <div className="space-y-6">
              {Object.entries(grouped).map(([group, items]) => (
                <div key={group} className="rounded-2xl border bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-black text-slate-800">{group}</h3>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setCheckedCodes((prev) => new Set([...prev, ...items.map((item) => item.code)]))}>تحديد الكل</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setCheckedCodes((prev) => new Set([...prev].filter((code) => !items.some((item) => item.code === code))))}>إلغاء المجموعة</Button>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {items.map((permission) => (
                      <label key={permission.id} className="flex cursor-pointer items-center gap-2 rounded-xl border bg-white p-3 text-sm font-bold">
                        <input type="checkbox" checked={checkedCodes.has(permission.code)} onChange={() => toggle(permission.code)} />
                        <span>{permission.name}</span>
                        <span className="mr-auto text-[10px] text-slate-400">{permission.code}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">لا يوجد دور محدد.</p>}
        {message ? <p className="mt-4 rounded-2xl border bg-slate-50 p-3 text-sm font-bold text-slate-700">{message}</p> : null}
      </section>
    </div>
  );
}
