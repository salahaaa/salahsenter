export const dynamic = "force-dynamic";

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, permissions, rolePermissions, roles, storeEmployees } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { userCanManageStoreEmployees } from "@/lib/rbac";
import { filterStorePermissionCodes } from "@/lib/permission-scopes";
import { writeAuditLog } from "@/lib/audit";

const patchSchema = z.object({ name: z.string().min(2).optional(), description: z.string().optional(), permissionCodes: z.array(z.string()).optional() });
function isStoreGroup(roleCode: string, storeId: string) { return roleCode.startsWith(`store_group_${storeId.replace(/-/g, "").slice(0, 12)}_`); }

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const primaryStore = await getMerchantPrimaryStore(session.userId);
    if (!primaryStore) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, primaryStore.id)) return fail("لا تملك الصلاحية", 403);
    if (!(await userCanManageStoreEmployees(session.userId, primaryStore.id, "permissions.manage"))) return fail("لا تملك صلاحية إدارة مجموعات الموظفين", 403);
    const payload = patchSchema.parse(await request.json());
    const [before] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!before || before.scope !== "store" || !isStoreGroup(before.code, primaryStore.id)) return fail("مجموعة الصلاحيات غير موجودة", 404);
    const groupPermissionCodes = payload.permissionCodes ? [...new Set(filterStorePermissionCodes(payload.permissionCodes))] : undefined;
    const result = await db.transaction(async (tx) => {
      const [role] = await tx.update(roles).set({ name: payload.name ?? before.name, description: payload.description ?? before.description, updatedAt: new Date() }).where(eq(roles.id, id)).returning();
      if (groupPermissionCodes) {
        await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
        if (groupPermissionCodes.length) {
          const rows = await tx.select().from(permissions).where(inArray(permissions.code, groupPermissionCodes));
          if (rows.length) await tx.insert(rolePermissions).values(rows.map((permission) => ({ roleId: id, permissionId: permission.id }))).onConflictDoNothing();
        }
      }
      return { role, permissionCodes: groupPermissionCodes };
    });
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "store_employee_group", entityId: id, beforeData: before, afterData: result });
    return ok({ ...result, message: "تم تحديث مجموعة الصلاحيات" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث مجموعة الصلاحيات");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const primaryStore = await getMerchantPrimaryStore(session.userId);
    if (!primaryStore) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, primaryStore.id)) return fail("لا تملك الصلاحية", 403);
    if (!(await userCanManageStoreEmployees(session.userId, primaryStore.id, "permissions.manage"))) return fail("لا تملك صلاحية إدارة مجموعات الموظفين", 403);
    const [role] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!role || role.scope !== "store" || !isStoreGroup(role.code, primaryStore.id)) return fail("مجموعة الصلاحيات غير موجودة", 404);
    await db.update(storeEmployees).set({ groupRoleId: null, updatedAt: new Date() }).where(eq(storeEmployees.groupRoleId, id));
    await db.delete(roles).where(eq(roles.id, id));
    await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "store_employee_group", entityId: id, beforeData: role });
    return ok({ message: "تم حذف مجموعة الصلاحيات وفصلها عن الموظفين" });
  } catch (error) {
    return handleApiError(error, "تعذر حذف مجموعة الصلاحيات");
  }
}
