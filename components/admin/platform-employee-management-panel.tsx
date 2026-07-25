"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Permission = { id: string; name: string; code: string; group: string };
type GroupRole = { id: string; name: string; code: string; scope: "system" | "store" };
type Employee = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  employeeNumber: string;
  jobTitle: string | null;
  departmentGroup: string | null;
  nationalId: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  groupRoleId: string | null;
  directRoleId: string | null;
  permissionCodes: string[];
};
type Filters = { q: string; status: string; groupRoleId: string; page: number };

/**
 * Platform staff panel — two-step flow:
 *   STEP 1  «إضافة موظف» — create the person with full employment data.
 *            The platform-access baseline (admin.access) is granted automatically so the
 *            employee can sign in; no permission matrix clutters this step.
 *   STEP 2  «إدارة الصلاحيات» — from the employee list, expand a row to grant / edit / revoke
 *            detailed platform permissions. The employee is pulled from the list (never re-typed).
 */
export function PlatformEmployeeManagementPanel({ employees, permissions, groups, filters, hasNext }: { employees: Employee[]; permissions: Permission[]; groups: GroupRole[]; filters: Filters; hasNext: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [permissionsEmployeeId, setPermissionsEmployeeId] = useState<string | null>(null);
  const groupedPermissions = useMemo(() => permissions.reduce<Record<string, Permission[]>>((acc, permission) => { acc[permission.group] ||= []; acc[permission.group].push(permission); return acc; }, {}), [permissions]);

  function pageHref(page: number) {
    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (filters.status) p.set("status", filters.status);
    if (filters.groupRoleId) p.set("groupRoleId", filters.groupRoleId);
    if (page > 1) p.set("page", String(page));
    const q = p.toString();
    return q ? `/admin/employees?${q}` : "/admin/employees";
  }

  // STEP 1 — create the employee record (data only).
  async function createEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: data.get("fullName"),
        email: data.get("email"),
        phone: data.get("phone") || undefined,
        password: data.get("password") || undefined,
        employeeNumber: data.get("employeeNumber") || undefined,
        jobTitle: data.get("jobTitle") || undefined,
        departmentGroup: data.get("departmentGroup") || undefined,
        nationalId: data.get("nationalId") || undefined,
        address: data.get("address") || undefined,
        notes: data.get("notes") || undefined,
        status: data.get("status") || "active",
        groupRoleId: data.get("groupRoleId") || undefined,
        // Baseline platform access only — detailed permissions are managed in STEP 2.
        permissionCodes: ["admin.access"]
      })
    });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? `✓ تمت إضافة الموظف${json.data?.temporaryPassword ? ` — كلمة المرور المؤقتة: ${json.data.temporaryPassword}` : ""}. افتح «إدارة الصلاحيات» لمنحه الصلاحيات التفصيلية.` : json.message || "تعذر إنشاء الموظف");
    if (response.ok) { form.reset(); setShowCreate(false); router.refresh(); }
  }

  // STEP 2 — manage (grant / edit / delete) permissions for an existing employee.
  async function savePermissions(employee: Employee, codes: Set<string>, groupRoleId: string | null) {
    const response = await fetch(`/api/admin/employees/${employee.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissionCodes: [...codes], groupRoleId }) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? `✓ تم تحديث صلاحيات ${employee.fullName}` : json.message || "تعذر حفظ الصلاحيات");
    if (response.ok) { setPermissionsEmployeeId(null); router.refresh(); }
  }

  async function updateEmployeeProfile(employee: Employee, patch: Record<string, unknown>) {
    const response = await fetch(`/api/admin/employees/${employee.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم حفظ بيانات الموظف" : json.message || "تعذر الحفظ");
    if (response.ok) router.refresh();
  }

  async function stopEmployee(employee: Employee) {
    if (!window.confirm("سيتم إيقاف الموظف وتعطيل جميع صلاحياته وبيانات دخوله. هل تريد المتابعة؟")) return;
    const response = await fetch(`/api/admin/employees/${employee.id}`, { method: "DELETE" });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم إيقاف الموظف وتعطيل صلاحياته" : json.message || "تعذر إيقاف الموظف");
    if (response.ok) router.refresh();
  }

  const permissionsTarget = employees.find((e) => e.id === permissionsEmployeeId) || null;

  return (
    <div className="space-y-6">
      {message ? <div className="rounded-2xl border bg-white p-4 text-sm font-bold text-slate-700 shadow-card">{message}</div> : null}

      {/* STEP 1 — add employee (full data) */}
      <section className="rounded-3xl border bg-white p-6 shadow-card">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">الخطوة 1 — إضافة موظف منصة بكامل بياناته</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">أدخل بيانات الموظف الوظيفية. سيُمنح دخول المنصة الأساسي، ثم تُدار الصلاحيات التفصيلية من القائمة في الخطوة 2.</p>
          </div>
          <Button type="button" onClick={() => setShowCreate((v) => !v)}>{showCreate ? "إخفاء النموذج" : "+ إضافة موظف"}</Button>
        </div>

        {showCreate ? (
          <form onSubmit={createEmployee} className="mb-2 rounded-3xl border bg-slate-50 p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="اسم الموظف" name="fullName" required />
              <Field label="البريد / اسم الدخول" name="email" type="email" required />
              <Field label="الهاتف" name="phone" />
              <Field label="الرقم الوظيفي" name="employeeNumber" placeholder="ADM-001" />
              <Field label="الوظيفة" name="jobTitle" placeholder="مدير مبيعات" />
              <Field label="المجموعة / الإدارة" name="departmentGroup" placeholder="المبيعات / الحسابات" />
              <Field label="رقم الهوية" name="nationalId" />
              <Field label="كلمة مرور اختيارية" name="password" type="password" />
              <div className="space-y-2"><Label>الحالة</Label><select name="status" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="active">مفعل</option><option value="pending">قيد الانتظار</option><option value="suspended">موقوف</option></select></div>
              <div className="space-y-2"><Label>مجموعة الصلاحيات (اختياري)</Label><select name="groupRoleId" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">بدون مجموعة</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>
              <div className="space-y-2 md:col-span-3"><Label>العنوان</Label><Input name="address" /></div>
              <div className="space-y-2 md:col-span-3"><Label>ملاحظات</Label><Textarea name="notes" /></div>
            </div>
            <div className="mt-4"><Button>حفظ بيانات الموظف</Button></div>
          </form>
        ) : null}

        <form action="/admin/employees" method="get" className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_170px_220px_auto_auto]">
          <Input name="q" defaultValue={filters.q} placeholder="بحث باسم الموظف، البريد، الرقم الوظيفي أو الوظيفة" />
          <select name="status" defaultValue={filters.status} className="h-11 rounded-xl border bg-white px-4 text-sm"><option value="">كل الحالات</option><option value="active">مفعل</option><option value="pending">قيد الانتظار</option><option value="suspended">موقوف</option><option value="deleted">محذوف</option></select>
          <select name="groupRoleId" defaultValue={filters.groupRoleId} className="h-11 rounded-xl border bg-white px-4 text-sm"><option value="">كل المجموعات</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
          <Button>بحث / فلترة</Button>
          <Button asChild variant="outline"><Link href="/admin/employees">تصفير</Link></Button>
        </form>

        {employees.length ? <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="mb-3"><h3 className="font-black text-blue-950">منح أو تعديل صلاحيات موظف منصة</h3><p className="mt-1 text-xs font-bold text-blue-800">اختر الموظف من القائمة، ثم تظهر صلاحيات المنصة مجمعة حسب كل إدارة. يمكنك إضافة أو سحب الصلاحيات ثم حفظها.</p></div>
          <div className="flex flex-wrap gap-2"><select value={permissionsEmployeeId || ""} onChange={(e) => setPermissionsEmployeeId(e.target.value || null)} className="h-11 min-w-72 rounded-xl border bg-white px-4 text-sm"><option value="">اختر الموظف</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName} — {employee.email}</option>)}</select>{permissionsEmployeeId ? <Button type="button" variant="outline" onClick={() => setPermissionsEmployeeId(null)}>إغلاق لوحة الصلاحيات</Button> : null}</div>
        </div> : null}

        {!employees.length ? <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">لا يوجد موظفون مطابقون.</p> : (
          <div className="mt-5 overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[1100px] text-right text-sm">
              <thead className="bg-slate-100"><tr><th className="p-3">الموظف</th><th className="p-3">الرقم / الوظيفة</th><th className="p-3">المجموعة</th><th className="p-3">الحالة</th><th className="p-3">الصلاحيات</th><th className="p-3">إجراءات</th></tr></thead>
              <tbody>
                {employees.map((employee) => {
                  const groupName = groups.find((group) => group.id === employee.groupRoleId)?.name || employee.departmentGroup || "بدون مجموعة";
                  return <EmployeeRow key={employee.id} employee={employee} groupName={groupName} permissionsCount={employee.permissionCodes.length} onManagePermissions={() => setPermissionsEmployeeId(employee.id)} onActivate={() => updateEmployeeProfile(employee, { status: "active" })} onSuspend={() => updateEmployeeProfile(employee, { status: "suspended" })} onStop={() => stopEmployee(employee)} />;
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-5 flex items-center justify-between gap-3 text-sm font-bold text-slate-500"><span>الصفحة {filters.page}</span><div className="flex gap-2">{filters.page > 1 ? <Button asChild size="sm" variant="outline"><Link href={pageHref(filters.page - 1)}>السابق</Link></Button> : null}{hasNext ? <Button asChild size="sm" variant="outline"><Link href={pageHref(filters.page + 1)}>التالي</Link></Button> : null}</div></div>
      </section>

      {/* STEP 2 — manage permissions (modal-style panel bound to the selected employee) */}
      {permissionsTarget ? (
        <PermissionsManager
          employee={permissionsTarget}
          groups={groups}
          groupedPermissions={groupedPermissions}
          onClose={() => setPermissionsEmployeeId(null)}
          onSave={savePermissions}
        />
      ) : null}
    </div>
  );
}

function EmployeeRow({ employee, groupName, permissionsCount, onManagePermissions, onActivate, onSuspend, onStop }: { employee: Employee; groupName: string; permissionsCount: number; onManagePermissions: () => void; onActivate: () => void; onSuspend: () => void; onStop: () => void }) {
  return (
    <tr className="border-t hover:bg-slate-50">
      <td className="p-3"><div className="font-black text-slate-950">{employee.fullName}</div><div className="text-xs text-slate-500">{employee.email}</div></td>
      <td className="p-3"><div className="font-bold">{employee.employeeNumber}</div><div className="text-xs text-slate-500">{employee.jobTitle || "-"}</div></td>
      <td className="p-3">{groupName}</td>
      <td className="p-3"><Badge variant={employee.status === "active" ? "success" : employee.status === "suspended" || employee.status === "deleted" ? "danger" : "warning"}>{employee.status}</Badge></td>
      <td className="p-3 font-bold">{permissionsCount}</td>
      <td className="p-3"><div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onManagePermissions}>إدارة الصلاحيات</Button>
        {employee.status !== "active" ? <Button type="button" size="sm" variant="outline" onClick={onActivate}>تفعيل</Button> : null}
        {employee.status === "active" ? <Button type="button" size="sm" variant="outline" onClick={onSuspend}>إيقاف مؤقت</Button> : null}
        <Button type="button" size="sm" variant="destructive" onClick={onStop}>إيقاف نهائي</Button>
      </div></td>
    </tr>
  );
}

/** STEP 2 panel — grant / edit / delete permissions for the employee pulled from the list. */
function PermissionsManager({ employee, groups, groupedPermissions, onClose, onSave }: { employee: Employee; groups: GroupRole[]; groupedPermissions: Record<string, Permission[]>; onClose: () => void; onSave: (employee: Employee, codes: Set<string>, groupRoleId: string | null) => void }) {
  const [codes, setCodes] = useState(new Set(employee.permissionCodes));
  const [groupRoleId, setGroupRoleId] = useState(employee.groupRoleId || "");
  function toggle(code: string) { const next = new Set(codes); next.has(code) ? next.delete(code) : next.add(code); setCodes(next); }
  return (
    <section className="rounded-3xl border-2 border-blue-200 bg-white p-6 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-black text-slate-950">الخطوة 2 — إدارة صلاحيات {employee.fullName}</h2><p className="mt-1 text-xs font-bold text-slate-500">منح / تعديل / حذف صلاحيات المنصة لهذا الموظف. تغييراتك قابلة للحفظ في أي وقت.</p></div>
        <Button type="button" variant="outline" onClick={onClose}>إغلاق</Button>
      </div>
      <div className="mb-4 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
        <div className="space-y-2"><Label>المجموعة الوراثية (تمنح صلاحياتها تلقائياً)</Label><select value={groupRoleId} onChange={(e) => setGroupRoleId(e.target.value)} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">بدون مجموعة</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>
        <div className="flex items-end"><Badge variant={codes.size ? "success" : "warning"}>صلاحيات مباشرة مفعّلة: {codes.size}</Badge></div>
      </div>
      <div className="space-y-4">
        {Object.entries(groupedPermissions).map(([group, items]) => (
          <div key={group} className="rounded-2xl border bg-white p-4">
            <h4 className="mb-3 font-black">{group}</h4>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {items.map((permission) => (
                <label key={permission.code} className="flex cursor-pointer items-center gap-2 rounded-xl border bg-slate-50 p-3 text-sm font-bold">
                  <input type="checkbox" checked={codes.has(permission.code)} onChange={() => toggle(permission.code)} />
                  <span>{permission.name}</span>
                  <span className="mr-auto text-[10px] text-slate-400">{permission.code}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" onClick={() => onSave(employee, codes, groupRoleId || null)}>حفظ الصلاحيات</Button>
        <Button type="button" variant="outline" onClick={() => setCodes(new Set(["admin.access"]))}>إعادة تعيين للأساسي</Button>
      </div>
    </section>
  );
}

function Field({ label, name, type = "text", required = false, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} required={required} placeholder={placeholder || ""} /></div>;
}
