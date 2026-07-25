export const dynamic = "force-dynamic";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, platformEmployees, roles, userRoles } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { loadPlatformPermissionManagement, replaceUserPermissionOverrides } from "@/lib/employees/permission-management";
import { assertAdminEmployeeAction } from "@/lib/rbac";

const overrideSchema = z.object({ code: z.string().min(2).max(160), effect: z.enum(["inherit", "grant", "deny"]) });
const patchSchema = z.object({
  employeeId: z.string().uuid(),
  groupRoleId: z.string().uuid().nullable().optional(),
  overrides: z.array(overrideSchema).max(500)
});

function summarizeChanges(before: Record<string, "grant" | "deny">, after: Array<{ code: string; effect: "grant" | "deny" }>) {
  const next = new Map(after.map((item) => [item.code, item.effect]));
  const granted = after.filter((item) => item.effect === "grant" && before[item.code] !== "grant").map((item) => item.code);
  const denied = after.filter((item) => item.effect === "deny" && before[item.code] !== "deny").map((item) => item.code);
  const removed = Object.keys(before).filter((code) => !next.has(code));
  return { granted, denied, removed };
}

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminEmployeeAction(session, "permissions.manage");
    return ok(await loadPlatformPermissionManagement());
  } catch (error) {
    return handleApiError(error, "تعذر تحميل إدارة الصلاحيات");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminEmployeeAction(session, "permissions.manage");
    const payload = patchSchema.parse(await request.json());
    const snapshot = await loadPlatformPermissionManagement();
    const employee = snapshot.employees.find((item) => item.id === payload.employeeId);
    if (!employee) return fail("الموظف غير موجود", 404);
    if (employee.userId === session.userId) return fail("لا يمكن تعديل صلاحيات حسابك من نفس الجلسة", 409);

    if (payload.groupRoleId) {
      const [groupRole] = await db.select({ id: roles.id, scope: roles.scope, code: roles.code, isSystem: roles.isSystem }).from(roles).where(eq(roles.id, payload.groupRoleId)).limit(1);
      if (!groupRole || groupRole.scope !== "system" || groupRole.isSystem || groupRole.code === "super_admin" || groupRole.code.startsWith("platform_employee_")) {
        return fail("مجموعة الصلاحيات المختارة غير صالحة", 422);
      }
    }

    const normalized = await db.transaction(async (tx) => {
      if (payload.groupRoleId !== undefined && payload.groupRoleId !== employee.groupRoleId) {
        const roleIds = [employee.groupRoleId, payload.groupRoleId].filter(Boolean) as string[];
        if (roleIds.length) await tx.delete(userRoles).where(and(eq(userRoles.userId, employee.userId), inArray(userRoles.roleId, roleIds)));
        if (payload.groupRoleId) await tx.insert(userRoles).values({ userId: employee.userId, roleId: payload.groupRoleId });
        await tx.update(platformEmployees).set({ groupRoleId: payload.groupRoleId, updatedAt: new Date() }).where(eq(platformEmployees.id, employee.id));
      }
      return replaceUserPermissionOverrides({
        userId: employee.userId,
        storeId: null,
        domain: "platform",
        overrides: payload.overrides,
        actorId: session.userId,
        tx: tx as unknown as typeof db
      });
    });

    const changes = summarizeChanges(employee.overrides, normalized);
    await writeAuditLog({
      actorId: session.userId,
      action: "update",
      entityType: "employee.platform.permission_overrides",
      entityId: employee.id,
      beforeData: { groupRoleId: employee.groupRoleId, overrides: employee.overrides, effectivePermissions: employee.inheritedPermissionCodes },
      afterData: { groupRoleId: payload.groupRoleId === undefined ? employee.groupRoleId : payload.groupRoleId, overrides: normalized, changes }
    });
    return ok({ overrides: normalized, changes, message: "تم حفظ الصلاحيات والتجاوزات الفردية للموظف" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ صلاحيات الموظف");
  }
}
