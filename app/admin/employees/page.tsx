import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { EmployeeDirectoryPanel } from "@/components/employees/employee-directory-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { db, platformEmployees, users } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { assertAdminEmployeeAction } from "@/lib/rbac";

export default async function AdminEmployeesPage() {
  const session = await requireAuth();
  await assertAdminEmployeeAction(session, "view");
  const employees = hasDatabase()
    ? await db
        .select({
          id: platformEmployees.id,
          userId: users.id,
          fullName: users.fullName,
          email: users.email,
          username: users.username,
          avatarUrl: users.avatarUrl,
          phone: users.phone,
          employeeNumber: platformEmployees.employeeNumber,
          jobTitle: platformEmployees.jobTitle,
          departmentGroup: platformEmployees.departmentGroup,
          nationalId: platformEmployees.nationalId,
          address: platformEmployees.address,
          notes: platformEmployees.notes,
          hiredAt: platformEmployees.hiredAt,
          status: platformEmployees.status
        })
        .from(platformEmployees)
        .innerJoin(users, eq(platformEmployees.userId, users.id))
        .orderBy(asc(users.fullName))
    : [];

  return <main className="min-h-screen admin-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">موظفو المنصة</h1><p className="mt-2 text-sm text-slate-500">بيانات الحساب والحالة مستقلة تماماً عن منح الصلاحيات. الحساب الجديد يبدأ بلا أي قدرة تشغيلية.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/admin/permissions-management">إدارة الصلاحيات</Link></Button><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div></div><EmployeeDirectoryPanel scope="platform" employees={employees} /></section></main>;
}
