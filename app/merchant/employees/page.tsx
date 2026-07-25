import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { EmployeeDirectoryPanel } from "@/components/employees/employee-directory-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, storeEmployees, users } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { userCanManageStoreEmployees } from "@/lib/rbac";

export default async function MerchantEmployeesPage() {
  const session = await requireAuth();
  const store = await getMerchantPrimaryStore(session.userId);
  if (store && (!hasStoreAccess(session, store.id) || !(await userCanManageStoreEmployees(session.userId, store.id, "view")))) {
    throw new Error("لا تملك صلاحية عرض موظفي المتجر");
  }
  const employees = store
    ? await db
        .select({
          id: storeEmployees.id,
          userId: users.id,
          fullName: users.fullName,
          email: users.email,
          username: users.username,
          avatarUrl: users.avatarUrl,
          phone: users.phone,
          employeeCode: storeEmployees.employeeCode,
          jobTitle: storeEmployees.jobTitle,
          nationalId: storeEmployees.nationalId,
          address: storeEmployees.address,
          notes: storeEmployees.notes,
          hiredAt: storeEmployees.hiredAt,
          status: storeEmployees.status
        })
        .from(storeEmployees)
        .innerJoin(users, eq(storeEmployees.userId, users.id))
        .where(eq(storeEmployees.storeId, store.id))
        .orderBy(asc(users.fullName))
    : [];

  return <main className="min-h-screen merchant-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">موظفو المتجر</h1><p className="mt-2 text-sm text-slate-500">حسابات موظفي المبيعات والمخزون والطلبات وخدمة العملاء؛ الصلاحيات في شاشة مستقلة ومقيدة بهذا المتجر فقط.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/merchant/permissions-management">إدارة الصلاحيات</Link></Button><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div></div>{!store ? <EmptyState title="لا يوجد متجر مرتبط بهذا الحساب" /> : <EmployeeDirectoryPanel scope="store" storeId={store.id} employees={employees} />}</section></main>;
}
