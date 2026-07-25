import Link from "next/link";
import { eq } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { RoleManagementPanel } from "@/components/admin/role-management-panel";
import { RoleTemplateForm } from "@/components/admin/enterprise/role-template-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { db, permissions, rolePermissions, roles, roleTemplates } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

export default async function AdminRolesPage() {
  const session = await requireAuth();
  await assertAdmin(session, "roles.manage");
  const [roleItems, permissionItems, assignments, templates] = hasDatabase()
    ? await Promise.all([
        db.select().from(roles).orderBy(roles.scope, roles.name),
        db.select().from(permissions).orderBy(permissions.group, permissions.code),
        db
          .select({ roleId: rolePermissions.roleId, permissionCode: permissions.code })
          .from(rolePermissions)
          .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id)),
        db.select().from(roleTemplates).orderBy(roleTemplates.scope, roleTemplates.name)
      ])
    : [[], [], [], []];

  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">إدارة الصلاحيات RBAC</h1>
            <p className="mt-2 text-sm text-slate-500">إنشاء أدوار وتعديل صلاحياتها وحفظها وربطها بالتحكم الفعلي داخل APIs.</p>
          </div>
          <Button asChild variant="outline"><Link href="/admin">العودة</Link></Button>
        </div>
        <RoleManagementPanel roles={roleItems} permissions={permissionItems} assignments={assignments} />
        <section id="advanced-rbac" className="mt-10 rounded-3xl border bg-white p-6 shadow-card">
          <div className="mb-5">
            <h2 className="text-2xl font-black text-slate-950">RBAC Builder المتقدم</h2>
            <p className="mt-1 text-sm text-slate-500">تم دمج Role Templates وCustom Permission overview داخل صفحة الصلاحيات لتقليل النوافذ.</p>
          </div>
          <RoleTemplateForm />
          <div className="mt-8 grid gap-8 xl:grid-cols-3">
            <MiniPanel title="Role Templates" items={templates.map((t) => ({ id: t.id, title: t.name, meta: `${t.scope} — ${t.permissionCodes.length} صلاحية`, status: t.isActive ? "نشط" : "معطل" }))} />
            <MiniPanel title="Roles" items={roleItems.map((r) => ({ id: r.id, title: r.name, meta: r.code, status: r.scope }))} />
            <MiniPanel title="Permissions" items={permissionItems.map((p) => ({ id: p.id, title: p.name, meta: p.code, status: p.group }))} />
          </div>
        </section>
      </section>
    </main>
  );
}

function MiniPanel({ title, items }: { title: string; items: Array<{ id: string; title: string; meta: string; status: string }> }) {
  return <div><h3 className="mb-4 text-lg font-black">{title}</h3>{!items.length ? <EmptyState title="لا توجد عناصر" /> : <div className="max-h-[520px] space-y-3 overflow-auto">{items.map((item) => <article key={item.id} className="rounded-2xl border bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><h4 className="truncate font-black">{item.title}</h4><p className="truncate text-xs text-slate-500">{item.meta}</p></div><Badge variant="outline">{item.status}</Badge></div></article>)}</div>}</div>;
}
