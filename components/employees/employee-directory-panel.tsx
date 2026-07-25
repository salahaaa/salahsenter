"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MediaUrlInput } from "@/components/media/media-url-input";

type Employee = {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  username: string | null;
  avatarUrl: string | null;
  phone: string | null;
  employeeNumber?: string | null;
  employeeCode?: string | null;
  jobTitle: string | null;
  departmentGroup?: string | null;
  nationalId: string | null;
  address: string | null;
  notes: string | null;
  hiredAt?: Date | string | null;
  status: string;
};

type Scope = "platform" | "store";

function statusLabel(status: string) {
  return ({ active: "نشط", suspended: "موقوف مؤقتاً", inactive: "غير مفعّل", pending: "قيد الانتظار", deleted: "محذوف" } as Record<string, string>)[status] || status;
}

function toDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/** Employee data only. Permission assignment intentionally lives on the independent permissions-management screen. */
export function EmployeeDirectoryPanel({ scope, storeId, employees }: { scope: Scope; storeId?: string; employees: Employee[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const endpoint = scope === "platform" ? "/api/admin/employees" : "/api/merchant/employees";
  const permissionHref = scope === "platform" ? "/admin/permissions-management" : "/merchant/permissions-management";
  const subject = scope === "platform" ? "موظف المنصة" : "موظف المتجر";

  async function send(url: string, method: "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.message || "تعذر حفظ التغيير");
    return json;
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await send(endpoint, "POST", payloadFromForm(form, scope, storeId));
      setMessage(result.data?.message || `تم إنشاء ${subject} بدون صلاحيات افتراضية.`);
      setCreating(false);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إنشاء الموظف");
    }
  }

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const payload = payloadFromForm(form, scope, storeId, true);
    try {
      const result = await send(`${endpoint}/${editing.id}`, "PATCH", payload);
      setMessage(result.data?.message || "تم تحديث بيانات الموظف");
      setEditing(null);
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تعديل الموظف");
    }
  }

  async function updateStatus(employee: Employee, status: "active" | "suspended" | "inactive") {
    try {
      const result = await send(`${endpoint}/${employee.id}`, "PATCH", { status });
      setMessage(result.data?.message || "تم تحديث حالة الحساب");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحديث حالة الحساب");
    }
  }

  async function inactivate(employee: Employee) {
    if (!window.confirm(`سيتم إلغاء تفعيل ${employee.fullName} ومنع دخوله فوراً مع الاحتفاظ بالبيانات والصلاحيات. هل تريد المتابعة؟`)) return;
    try {
      const result = await send(`${endpoint}/${employee.id}`, "DELETE");
      setMessage(result.data?.message || "تم إلغاء تفعيل الموظف");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إلغاء تفعيل الموظف");
    }
  }

  return (
    <div className="space-y-6">
      {message ? <p className="rounded-2xl border bg-white p-4 text-sm font-bold text-slate-700 shadow-card">{message}</p> : null}
      <section className="rounded-3xl border bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-950">إدارة الموظفين</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">إنشاء وتعديل وحالات حسابات الموظفين فقط. لا تُمنح أي صلاحية عند الحفظ؛ انتقل إلى شاشة إدارة الصلاحيات المستقلة بعد إنشاء الحساب.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href={permissionHref}>إدارة الصلاحيات</Link></Button>
            <Button type="button" onClick={() => { setCreating((value) => !value); setEditing(null); }}>{creating ? "إخفاء النموذج" : `+ إضافة ${subject}`}</Button>
          </div>
        </div>
        {creating ? <EmployeeForm scope={scope} storeId={storeId} submitLabel={`إنشاء ${subject} بدون صلاحيات`} onSubmit={create} /> : null}
        {editing ? <EmployeeForm key={editing.id} scope={scope} storeId={storeId} employee={editing} submitLabel="حفظ التعديلات" onSubmit={update} onCancel={() => setEditing(null)} /> : null}
      </section>

      <section className="overflow-hidden rounded-3xl border bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="font-black text-slate-950">دليل الموظفين</h2><p className="mt-1 text-xs font-bold text-slate-500">الحالة غير النشطة أو الموقوفة تمنع الدخول فوراً وتحتفظ بسجل الصلاحيات.</p></div><Badge variant="outline">{employees.length} موظف</Badge></div>
        {!employees.length ? <p className="p-6 text-sm font-bold text-slate-500">لا يوجد موظفون بعد.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1060px] text-right text-sm"><thead className="bg-slate-50"><tr><th className="p-3">الموظف</th><th className="p-3">اسم المستخدم</th><th className="p-3">الوظيفة / القسم</th><th className="p-3">التواصل</th><th className="p-3">الحالة</th><th className="p-3">إجراءات</th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id} className="border-t hover:bg-slate-50"><td className="p-3"><div className="flex items-center gap-3">{employee.avatarUrl ? <img src={employee.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 font-black text-slate-600">{employee.fullName.slice(0, 1)}</span>}<div><div className="font-black text-slate-950">{employee.fullName}</div><div className="text-xs text-slate-500">{employee.employeeNumber || employee.employeeCode || "—"}</div></div></div></td><td className="p-3 font-mono text-xs">{employee.username || "—"}</td><td className="p-3"><div className="font-bold">{employee.jobTitle || "—"}</div><div className="text-xs text-slate-500">{employee.departmentGroup || "—"}</div></td><td className="p-3"><div>{employee.email}</div><div className="text-xs text-slate-500">{employee.phone || "—"}</div></td><td className="p-3"><Badge variant={employee.status === "active" ? "success" : employee.status === "suspended" ? "danger" : "warning"}>{statusLabel(employee.status)}</Badge></td><td className="p-3"><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => { setEditing(employee); setCreating(false); }}>تعديل</Button>{employee.status !== "active" ? <Button type="button" size="sm" onClick={() => updateStatus(employee, "active")}>تفعيل</Button> : <Button type="button" size="sm" variant="outline" onClick={() => updateStatus(employee, "suspended")}>إيقاف مؤقت</Button>}<Button type="button" size="sm" variant="destructive" onClick={() => inactivate(employee)}>إلغاء التفعيل</Button></div></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}

function EmployeeForm({ scope, storeId, employee, submitLabel, onSubmit, onCancel }: { scope: Scope; storeId?: string; employee?: Employee | null; submitLabel: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel?: () => void }) {
  const isEdit = Boolean(employee);
  return <form onSubmit={onSubmit} className="mt-6 rounded-3xl border bg-slate-50 p-5"><div className="grid gap-4 md:grid-cols-3"><Field label="الاسم الكامل" name="fullName" required defaultValue={employee?.fullName} /><Field label="البريد الإلكتروني" name="email" type="email" required defaultValue={employee?.email} /><Field label="اسم المستخدم" name="username" required defaultValue={employee?.username || ""} placeholder="sale.agent_1" /><Field label="رقم الهاتف" name="phone" defaultValue={employee?.phone || ""} /><Field label={scope === "platform" ? "الرقم الوظيفي" : "كود الموظف"} name={scope === "platform" ? "employeeNumber" : "employeeCode"} defaultValue={employee?.employeeNumber || employee?.employeeCode || ""} /><Field label="الوظيفة" name="jobTitle" defaultValue={employee?.jobTitle || ""} />{scope === "platform" ? <Field label="القسم" name="departmentGroup" defaultValue={employee?.departmentGroup || ""} /> : null}<Field label={isEdit ? "كلمة مرور جديدة (اختيارية)" : "كلمة المرور"} name={isEdit ? "newPassword" : "password"} type="password" required={!isEdit} placeholder="12 حرفاً على الأقل" /><div className="space-y-2"><Label>حالة الحساب</Label><select name="status" defaultValue={employee?.status || "active"} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="active">ACTIVE — نشط</option><option value="suspended">SUSPENDED — إيقاف مؤقت</option><option value="inactive">INACTIVE — غير مفعّل</option></select></div><Field label="رقم الهوية" name="nationalId" defaultValue={employee?.nationalId || ""} /><Field label="تاريخ التوظيف" name="hiredAt" type="date" defaultValue={toDateInput(employee?.hiredAt)} /><div className="md:col-span-3"><MediaUrlInput label="صورة الموظف" name="avatarUrl" storeId={scope === "store" ? storeId : undefined} folder={scope === "store" ? `stores/${storeId}/employees` : "platform/employees"} defaultValue={employee?.avatarUrl || ""} accept="image/*" /></div><div className="md:col-span-3"><Label htmlFor="address">العنوان</Label><Textarea id="address" name="address" defaultValue={employee?.address || ""} /></div><div className="md:col-span-3"><Label htmlFor="notes">ملاحظات إدارية</Label><Textarea id="notes" name="notes" defaultValue={employee?.notes || ""} /></div></div><div className="mt-5 flex flex-wrap gap-2"><Button>{submitLabel}</Button>{onCancel ? <Button type="button" variant="outline" onClick={onCancel}>إلغاء</Button> : null}</div>{!isEdit ? <p className="mt-3 text-xs font-bold text-amber-700">لن يكتسب الموظف أي دور تشغيلي أو صلاحية تلقائياً. استخدم «إدارة الصلاحيات» بعد حفظ الحساب.</p> : null}</form>;
}

function Field({ label, name, type = "text", required = false, defaultValue, placeholder }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string | null; placeholder?: string }) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} defaultValue={defaultValue || ""} placeholder={placeholder} /></div>; }

function payloadFromForm(form: FormData, scope: Scope, storeId?: string, isEdit = false) {
  const raw = (name: string) => String(form.get(name) || "").trim();
  const optional = (name: string) => raw(name) || undefined;
  const payload: Record<string, unknown> = {
    fullName: raw("fullName"), email: raw("email"), username: raw("username"), phone: optional("phone"), avatarUrl: optional("avatarUrl"), jobTitle: optional("jobTitle"), nationalId: optional("nationalId"), address: optional("address"), notes: optional("notes"), hiredAt: raw("hiredAt") ? new Date(`${raw("hiredAt")}T00:00:00.000Z`).toISOString() : null, status: raw("status")
  };
  if (scope === "platform") { payload.employeeNumber = optional("employeeNumber"); payload.departmentGroup = optional("departmentGroup"); }
  else { payload.storeId = storeId; payload.employeeCode = optional("employeeCode"); }
  const password = optional(isEdit ? "newPassword" : "password");
  if (password) payload[isEdit ? "newPassword" : "password"] = password;
  return payload;
}
