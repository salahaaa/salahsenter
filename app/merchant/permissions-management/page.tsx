import Link from "next/link";
import { EmployeePermissionManagementPanel } from "@/components/employees/employee-permission-management-panel";
import { StoreRoleBuilder } from "@/components/employees/store-role-builder";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { loadStorePermissionManagement } from "@/lib/employees/permission-management";
import { userCanManageStoreEmployees } from "@/lib/rbac";

export default async function MerchantPermissionsManagementPage() {
  const session = await requireAuth();
  const store = await getMerchantPrimaryStore(session.userId);
  if (store && (!hasStoreAccess(session, store.id) || !(await userCanManageStoreEmployees(session.userId, store.id, "permissions.manage")))) {
    throw new Error("لا تملك صلاحية إدارة صلاحيات الموظفين");
  }
  const data = store ? await loadStorePermissionManagement(store.id) : null;
  return <main className="min-h-screen merchant-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">إدارة صلاحيات موظفي المتجر</h1><p className="mt-2 text-sm text-slate-500">تجاوزات فردية دقيقة فوق الأدوار، ضمن متجر واحد فقط ودون أي وصول لبيانات متجر آخر.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/merchant/employees">إدارة الموظفين</Link></Button><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div></div>{!store || !data ? <EmptyState title="لا يوجد متجر مرتبط بهذا الحساب" /> : <div className="space-y-6"><StoreRoleBuilder storeId={store.id} permissions={data.permissions} groups={data.groups} /><EmployeePermissionManagementPanel scope="store" storeId={store.id} {...data} /></div>}</section></main>;
}
