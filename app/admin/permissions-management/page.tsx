import Link from "next/link";
import { EmployeePermissionManagementPanel } from "@/components/employees/employee-permission-management-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { loadPlatformPermissionManagement } from "@/lib/employees/permission-management";
import { assertAdminEmployeeAction } from "@/lib/rbac";

export default async function AdminPermissionsManagementPage() {
  const session = await requireAuth();
  await assertAdminEmployeeAction(session, "permissions.manage");
  const data = await loadPlatformPermissionManagement();
  return <main className="min-h-screen admin-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">إدارة صلاحيات موظفي المنصة</h1><p className="mt-2 text-sm text-slate-500">شاشة مستقلة للأدوار والصلاحيات والتجاوزات الفردية على مستوى كل إدارة وكل عملية.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/admin/employees">إدارة الموظفين</Link></Button><Button asChild variant="outline"><Link href="/admin/roles">إدارة الأدوار</Link></Button><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div></div><EmployeePermissionManagementPanel scope="platform" {...data} /></section></main>;
}
