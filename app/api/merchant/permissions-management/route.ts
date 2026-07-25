export const dynamic = "force-dynamic";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, roles, storeEmployees, userRoles } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { writeAuditLog } from "@/lib/audit";
import { loadStorePermissionManagement, replaceUserPermissionOverrides } from "@/lib/employees/permission-management";
import { userCanManageStoreEmployees } from "@/lib/rbac";

const overrideSchema = z.object({ code: z.string().min(2).max(160), effect: z.enum(["inherit", "grant", "deny"]) });
const patchSchema = z.object({
  storeId: z.string().uuid().optional(),
  employeeId: z.string().uuid(),
  groupRoleId: z.string().uuid().nullable().optional(),
  overrides: z.array(overrideSchema).max(500)
});

function summarizeChanges(before: Record<string, "grant" | "deny">, after: Array<{ code: string; effect: "grant" | "deny" }>) {
  const next = new Map(after.map((item) => [item.code, item.effect]));
  return {
    granted: after.filter((item) => item.effect === "grant" && before[item.code] !== "grant").map((item) => item.code),
    denied: after.filter((item) => item.effect === "deny" && before[item.code] !== "deny").map((item) => item.code),
    removed: Object.keys(before).filter((code) => !next.has(code))
  };
}

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const primaryStore = await getMerchantPrimaryStore(session.userId);
    const requestedStoreId = new URL(request.url).searchParams.get("storeId");
    const storeId = requestedStoreId || primaryStore?.id;
    if (!storeId) return fail("لا يوجد متجر مرتبط بالحساب", 403);
    if (!hasStoreAccess(session, storeId)) return fail("لا تملك الصلاحية", 403);
    if (!(await userCanManageStoreEmployees(session.userId, storeId, "permissions.manage"))) return fail("لا تملك صلاحية إدارة صلاحيات الموظفين", 403);
    return ok(await loadStorePermissionManagement(storeId));
  } catch (error) {
    return handleApiError(error, "تعذر تحميل إدارة الصلاحيات");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const payload = patchSchema.parse(await request.json());
    const [target] = await db.select({ id: storeEmployees.id, storeId: storeEmployees.storeId, userId: storeEmployees.userId }).from(storeEmployees).where(eq(storeEmployees.id, payload.employeeId)).limit(1);
    if (!target) return fail("الموظف غير موجود", 404);
    if (payload.storeId && payload.storeId !== target.storeId) return fail("الموظف لا يتبع هذا المتجر", 422);
    if (!hasStoreAccess(session, target.storeId)) return fail("لا تملك الصلاحية", 403);
    if (!(await userCanManageStoreEmployees(session.userId, target.storeId, "permissions.manage"))) return fail("لا تملك صلاحية إدارة صلاحيات الموظفين", 403);
    if (target.userId === session.userId) return fail("لا يمكن تعديل صلاحيات حسابك من نفس الجلسة", 409);

    const snapshot = await loadStorePermissionManagement(target.storeId);
    const employee = snapshot.employees.find((item) => item.id === payload.employeeId);
    if (!employee) return fail("الموظف غير موجود في نطاق المتجر", 404);
    if (payload.groupRoleId) {
      const [groupRole] = await db.select({ id: roles.id, scope: roles.scope, code: roles.code }).from(roles).where(eq(roles.id, payload.groupRoleId)).limit(1);
      const prefix = `store_group_${target.storeId.replace(/-/g, "").slice(0, 12)}_`;
      if (!groupRole || groupRole.scope !== "store" || !groupRole.code.startsWith(prefix)) return fail("مجموعة الصلاحيات المختارة لا تتبع هذا المتجر", 422);
    }

    const normalized = await db.transaction(async (tx) => {
      if (payload.groupRoleId !== undefined && payload.groupRoleId !== employee.groupRoleId) {
        const roleIds = [employee.groupRoleId, payload.groupRoleId].filter(Boolean) as string[];
        if (roleIds.length) await tx.delete(userRoles).where(and(eq(userRoles.userId, employee.userId), eq(userRoles.storeId, target.storeId), inArray(userRoles.roleId, roleIds)));
        if (payload.groupRoleId) await tx.insert(userRoles).values({ userId: employee.userId, roleId: payload.groupRoleId, storeId: target.storeId });
        await tx.update(storeEmployees).set({ groupRoleId: payload.groupRoleId, updatedAt: new Date() }).where(eq(storeEmployees.id, employee.id));
      }
      return replaceUserPermissionOverrides({
        userId: employee.userId,
        storeId: target.storeId,
        domain: "store",
        overrides: payload.overrides,
        actorId: session.userId,
        tx: tx as unknown as typeof db
      });
    });
    const changes = summarizeChanges(employee.overrides, normalized);
    await writeAuditLog({
      actorId: session.userId,
      action: "update",
      entityType: "employee.store.permission_overrides",
      entityId: employee.id,
      beforeData: { storeId: target.storeId, groupRoleId: employee.groupRoleId, overrides: employee.overrides, effectivePermissions: employee.inheritedPermissionCodes },
      afterData: { storeId: target.storeId, groupRoleId: payload.groupRoleId === undefined ? employee.groupRoleId : payload.groupRoleId, overrides: normalized, changes }
    });
    return ok({ overrides: normalized, changes, message: "تم حفظ الصلاحيات والتجاوزات الفردية للموظف ضمن هذا المتجر فقط" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ صلاحيات الموظف");
  }
}
