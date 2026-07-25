"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type Permission = { code: string; name: string; group: string };
type Group = { id: string; name: string; code: string; description: string | null; permissionCodes: string[] };
type Employee = {
  id: string;
  userId: string;
  roleId: string | null;
  groupRoleId?: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  employeeCode: string | null;
  nationalId: string | null;
  jobTitle: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  permissionCodes: string[];
};

/**
 * Store staff panel (merchant domain) — two-step flow:
 *   STEP 1  «إضافة موظف» — create the store employee with full personal/employment data.
 *            Baseline store access (merchant.access) is granted automatically.
 *   STEP 2  «إدارة الصلاحيات» — from the list, expand a row to grant / edit / revoke the
 *            STORE-scoped permissions this merchant controls. Only store capabilities appear here;
 *            platform permissions are managed in the admin panel — the two can no longer mix.
 */
export function EmployeeManagementPanel({ storeId, employees, permissions, groups }: { storeId: string; employees: Employee[]; permissions: Permission[]; groups: Group[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [permissionsEmployeeId, setPermissionsEmployeeId] = useState<string | null>(null);
  const permissionByCode = useMemo(() => new Map(permissions.map((permission) => [permission.code, permission])), [permissions]);

  // STEP 1 — create the store employee record (data only).
  async function createEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/merchant/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        fullName: form.get("fullName"),
        email: form.get("email"),
        phone: form.get("phone") || undefined,
        employeeCode: form.get("employeeCode") || undefined,
        nationalId: form.get("nationalId") || undefined,
        jobTitle: form.get("jobTitle") || undefined,
        address: form.get("address") || undefined,
        notes: form.get("notes") || undefined,
        password: form.get("password") || undefined,
        status: form.get("status") || "active",
        groupRoleId: form.get("groupRoleId") || undefined,
        // Baseline store access only — detailed store permissions are managed in STEP 2.
        permissionCodes: ["merchant.access"]
      })
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(json.message || "تعذر إنشاء الموظف");
    setMessage(json.data?.temporaryPassword ? `✓ تمت إضافة الموظف. كلمة المرور المؤقتة: ${json.data.temporaryPassword}. افتح «إدارة الصلاحيات» لمنحه الصلاحيات.` : "✓ تمت إضافة الموظف. افتح «إدارة الصلاحيات» لمنحه الصلاحيات.");
    formElement.reset();
    setShowCreate(false);
    router.refresh();
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const permissionCodes = permissions.map((permission) => permission.code).filter((code) => form.get(`group-${code}`) === "on");
    const response = await fetch("/api/merchant/employees/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, name: form.get("name"), description: form.get("description") || undefined, permissionCodes: permissionCodes.length ? permissionCodes : ["merchant.access"] }) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم إنشاء مجموعة الصلاحيات" : json.message || "تعذر إنشاء المجموعة");
    if (response.ok) { formElement.reset(); setShowGroupCreate(false); router.refresh(); }
  }

  // STEP 2 — grant / edit / delete store permissions for an existing employee.
  async function savePermissions(employee: Employee, codes: Set<string>, groupRoleId: string | null) {
    const response = await fetch(`/api/merchant/employees/${employee.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissionCodes: [...codes], groupRoleId: groupRoleId || null }) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? `✓ تم تحديث صلاحيات ${employee.fullName}` : json.message || "تعذر حفظ الصلاحيات");
    if (response.ok) { setPermissionsEmployeeId(null); router.refresh(); }
  }

  async function updateEmployeeProfile(employee: Employee, patch: Record<string, unknown>) {
    const response = await fetch(`/api/merchant/employees/${employee.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم تحديث بيانات الموظف" : json.message || "تعذر تحديث الموظف");
    if (response.ok) router.refresh();
  }

  async function deleteEmployee(employee: Employee) {
    if (!window.confirm("هل تريد إيقاف الموظف وتعطيل كل صلاحياته؟")) return;
    const response = await fetch(`/api/merchant/employees/${employee.id}`, { method: "DELETE" });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم إيقاف الموظف وتعطيل كل صلاحياته" : json.message || "تعذر تعطيل الموظف");
    if (response.ok) router.refresh();
  }

  async function updateGroup(group: Group, permissionCodes: string[]) {
    const response = await fetch(`/api/merchant/employees/groups/${group.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissionCodes }) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم حفظ صلاحيات المجموعة" : json.message || "تعذر حفظ المجموعة");
    if (response.ok) router.refresh();
  }

  const permissionsTarget = employees.find((e) => e.id === permissionsEmployeeId) || null;

  return (
    <div className="space-y-6">
      {message ? <div className="rounded-2xl border bg-white p-4 text-sm font-bold text-slate-700 shadow-card">{message}</div> : null}

      {/* Permission groups (store-scoped) */}
      <section className="rounded-3xl border bg-white p-6 shadow-card">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-black text-slate-950">مجموعات صلاحيات المتجر</h2><p className="mt-1 text-xs font-bold text-slate-500">مثال: المبيعات، المخزون، الحسابات. الموظف يرث صلاحيات مجموعته وتُضاف عليها صلاحياته المباشرة.</p></div>
          <Button type="button" variant="outline" onClick={() => setShowGroupCreate((v) => !v)}>{showGroupCreate ? "إخفاء" : "+ إضافة مجموعة"}</Button>
        </div>
        {showGroupCreate ? (
          <form onSubmit={createGroup} className="mb-5 rounded-2xl border bg-slate-50 p-4">
            <div className="grid gap-4 md:grid-cols-2"><Field label="اسم المجموعة" name="name" placeholder="مجموعة المبيعات" required /><Field label="وصف" name="description" /></div>
            <PermissionGrid permissionByCode={permissionByCode} prefix="group-" defaultCodes={["merchant.access"]} />
            <div className="mt-4"><Button>حفظ المجموعة</Button></div>
          </form>
        ) : null}
        {!groups.length ? <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">لا توجد مجموعات بعد.</p> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{groups.map((group) => <GroupCard key={group.id} group={group} permissionByCode={permissionByCode} onSave={updateGroup} />)}</div>
        )}
      </section>

      {/* STEP 1 — add store employee (full data) */}
      <section className="rounded-3xl border bg-white p-6 shadow-card">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-black">الخطوة 1 — إضافة موظف بكامل بياناته</h2><p className="mt-1 text-xs font-bold text-slate-500">أدخل بيانات الموظف. سيُمنح دخول المتجر الأساسي، ثم تُدار صلاحياته التفصيلية من القائمة في الخطوة 2.</p></div>
          <Button type="button" onClick={() => setShowCreate((v) => !v)}>{showCreate ? "إخفاء النموذج" : "+ إضافة موظف"}</Button>
        </div>
        {showCreate ? (
          <form onSubmit={createEmployee} className="mb-2 rounded-3xl border bg-slate-50 p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="الاسم الكامل" name="fullName" required />
              <Field label="البريد / اسم الدخول" name="email" type="email" required />
              <Field label="رقم الهاتف" name="phone" />
              <Field label="الرقم الوظيفي" name="employeeCode" placeholder="EMP-001" />
              <Field label="رقم الهوية" name="nationalId" />
              <Field label="الوظيفة" name="jobTitle" placeholder="مندوب مبيعات" />
              <Field label="كلمة مرور اختيارية" name="password" type="password" />
              <div className="space-y-2"><Label>المجموعة</Label><select name="groupRoleId" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">بدون مجموعة</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>
              <div className="space-y-2"><Label>الحالة</Label><select name="status" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="active">مفعل</option><option value="pending">قيد الانتظار</option><option value="suspended">موقوف</option></select></div>
              <div className="space-y-2 md:col-span-3"><Label>العنوان</Label><Input name="address" /></div>
              <div className="space-y-2 md:col-span-3"><Label>ملاحظات</Label><Textarea name="notes" /></div>
            </div>
            <div className="mt-5"><Button>حفظ بيانات الموظف</Button></div>
          </form>
        ) : null}

        {employees.length ? <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="mb-3"><h3 className="font-black text-emerald-950">منح أو تعديل صلاحيات موظف</h3><p className="mt-1 text-xs font-bold text-emerald-800">اختر الموظف من القائمة، ثم ستظهر لوحة الصلاحيات حسب كل إدارة. يمكنك إضافة أو سحب أي صلاحية ثم حفظها.</p></div>
          <div className="flex flex-wrap gap-2"><select value={permissionsEmployeeId || ""} onChange={(e) => setPermissionsEmployeeId(e.target.value || null)} className="h-11 min-w-72 rounded-xl border bg-white px-4 text-sm"><option value="">اختر الموظف</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName} — {employee.email}</option>)}</select>{permissionsEmployeeId ? <Button type="button" variant="outline" onClick={() => setPermissionsEmployeeId(null)}>إغلاق لوحة الصلاحيات</Button> : null}</div>
        </div> : null}

        {!employees.length ? <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">لا يوجد موظفون بعد.</p> : (
          <div className="mt-5 overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[1050px] text-right text-sm">
              <thead className="bg-slate-100"><tr><th className="p-3">الموظف</th><th className="p-3">الرقم / الوظيفة</th><th className="p-3">المجموعة</th><th className="p-3">الحالة</th><th className="p-3">الصلاحيات</th><th className="p-3">إجراءات</th></tr></thead>
              <tbody>
                {employees.map((employee) => {
                  const groupName = groups.find((group) => group.id === employee.groupRoleId)?.name || "بدون مجموعة";
                  return <EmployeeRow key={employee.id} employee={employee} groupName={groupName} permissionsCount={employee.permissionCodes.length} onManagePermissions={() => setPermissionsEmployeeId(employee.id)} onActivate={() => updateEmployeeProfile(employee, { status: "active" })} onSuspend={() => updateEmployeeProfile(employee, { status: "suspended" })} onDelete={() => deleteEmployee(employee)} />;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* STEP 2 — manage store permissions (bound to selected employee) */}
      {permissionsTarget ? (
        <PermissionsManager
          employee={permissionsTarget}
          groups={groups}
          permissionByCode={permissionByCode}
          onClose={() => setPermissionsEmployeeId(null)}
          onSave={savePermissions}
        />
      ) : null}
    </div>
  );
}

function GroupCard({ group, permissionByCode, onSave }: { group: Group; permissionByCode: Map<string, Permission>; onSave: (group: Group, permissionCodes: string[]) => void }) {
  const [codes, setCodes] = useState(new Set(group.permissionCodes));
  return <div className="rounded-2xl border bg-slate-50 p-4"><h3 className="font-black">{group.name}</h3><p className="mt-1 text-xs text-slate-500">{group.description || "مجموعة صلاحيات"}</p><PermissionGrid permissionByCode={permissionByCode} checkedCodes={codes} onChange={setCodes} /><Button type="button" size="sm" className="mt-3" onClick={() => onSave(group, [...codes])}>حفظ صلاحيات المجموعة</Button></div>;
}

function EmployeeRow({ employee, groupName, permissionsCount, onManagePermissions, onActivate, onSuspend, onDelete }: { employee: Employee; groupName: string; permissionsCount: number; onManagePermissions: () => void; onActivate: () => void; onSuspend: () => void; onDelete: () => void }) {
  return (
    <tr className="border-t hover:bg-slate-50">
      <td className="p-3"><div className="font-black text-slate-950">{employee.fullName}</div><div className="text-xs text-slate-500">{employee.email}</div></td>
      <td className="p-3"><div className="font-bold">{employee.employeeCode || "-"}</div><div className="text-xs text-slate-500">{employee.jobTitle || "-"}</div></td>
      <td className="p-3">{groupName}</td>
      <td className="p-3"><Badge variant={employee.status === "active" ? "success" : employee.status === "suspended" || employee.status === "deleted" ? "danger" : "warning"}>{employee.status}</Badge></td>
      <td className="p-3 font-bold">{permissionsCount}</td>
      <td className="p-3"><div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onManagePermissions}>إدارة الصلاحيات</Button>
        {employee.status !== "active" ? <Button type="button" size="sm" variant="outline" onClick={onActivate}>تفعيل</Button> : null}
        {employee.status === "active" ? <Button type="button" size="sm" variant="outline" onClick={onSuspend}>إيقاف مؤقت</Button> : null}
        <Button type="button" size="sm" variant="destructive" onClick={onDelete}>إيقاف</Button>
      </div></td>
    </tr>
  );
}

/** STEP 2 panel — grant / edit / delete STORE permissions for the selected employee. */
function PermissionsManager({ employee, groups, permissionByCode, onClose, onSave }: { employee: Employee; groups: Group[]; permissionByCode: Map<string, Permission>; onClose: () => void; onSave: (employee: Employee, codes: Set<string>, groupRoleId: string | null) => void }) {
  const [codes, setCodes] = useState(new Set(employee.permissionCodes));
  const [groupRoleId, setGroupRoleId] = useState(employee.groupRoleId || "");
  return (
    <section className="rounded-3xl border-2 border-emerald-200 bg-white p-6 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-black text-slate-950">الخطوة 2 — إدارة صلاحيات {employee.fullName}</h2><p className="mt-1 text-xs font-bold text-slate-500">منح / تعديل / حذف صلاحيات المتجر لهذا الموظف. هذه الصلاحيات محصورة في نطاق متجرك فقط.</p></div>
        <Button type="button" variant="outline" onClick={onClose}>إغلاق</Button>
      </div>
      <div className="mb-4 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
        <div className="space-y-2"><Label>المجموعة الوراثية</Label><select value={groupRoleId} onChange={(e) => setGroupRoleId(e.target.value)} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">بدون مجموعة</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>
        <div className="flex items-end"><Badge variant={codes.size ? "success" : "warning"}>صلاحيات مباشرة مفعّلة: {codes.size}</Badge></div>
      </div>
      <PermissionGrid permissionByCode={permissionByCode} checkedCodes={codes} onChange={setCodes} />
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" onClick={() => onSave(employee, codes, groupRoleId || null)}>حفظ الصلاحيات</Button>
        <Button type="button" variant="outline" onClick={() => setCodes(new Set(["merchant.access"]))}>إعادة تعيين للأساسي</Button>
      </div>
    </section>
  );
}

function PermissionGrid({ permissionByCode, defaultCodes = [], checkedCodes, onChange, prefix = "" }: { permissionByCode: Map<string, Permission>; defaultCodes?: string[]; checkedCodes?: Set<string>; onChange?: (codes: Set<string>) => void; prefix?: string }) {
  const [localCodes, setLocalCodes] = useState(new Set(defaultCodes));
  const activeCodes = checkedCodes || localCodes;
  function update(next: Set<string>) { onChange ? onChange(next) : setLocalCodes(next); }
  function toggle(code: string) { const next = new Set(activeCodes); next.has(code) ? next.delete(code) : next.add(code); update(next); }
  const groups = [...permissionByCode.values()].reduce<Record<string, Permission[]>>((acc, permission) => { acc[permission.group || "عام"] ||= []; acc[permission.group || "عام"].push(permission); return acc; }, {});
  const groupTitles: Record<string, string> = {
    store: "إدارة المتجر",
    products: "إدارة المنتجات",
    inventory: "إدارة المخزون",
    orders: "إدارة الطلبات",
    content: "المحتوى والإعلانات",
    merchant: "صلاحيات التاجر الأساسية",
    "merchant.catalog": "الأصناف والكتالوج",
    "merchant.marketing": "التسويق والعروض والإعلانات",
    "merchant.finance": "المالية وإثباتات الدفع",
    "merchant.orders": "الطلبات والمرتجعات",
    "merchant.operations": "التشغيل والشحن والدفع",
    general: "عام",
    عام: "عام"
  };
  return <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Object.entries(groups).map(([group, permissions]) => (
    <div key={group} className="rounded-2xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><h4 className="font-black">{groupTitles[group] || group}</h4><div className="flex gap-1"><button type="button" onClick={() => update(new Set([...activeCodes, ...permissions.map((p) => p.code)]))} className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700">كلها</button><button type="button" onClick={() => update(new Set([...activeCodes].filter((code) => !permissions.some((p) => p.code === code))))} className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-600">مسح</button></div></div>
      <div className="space-y-2">{permissions.map((permission) => (
        <label key={permission.code} className="flex items-center gap-2 rounded-xl border bg-slate-50 p-3 text-sm font-bold">
          <input name={`${prefix}${permission.code}`} type="checkbox" checked={activeCodes.has(permission.code)} onChange={() => toggle(permission.code)} />
          <span>{permission.name || permission.code}</span>
          <span className="mr-auto text-[10px] text-slate-400">{permission.code}</span>
        </label>
      ))}</div>
    </div>
  ))}</div>;
}

function Field({ label, name, type = "text", required = false, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} required={required} placeholder={placeholder || ""} /></div>;
}
