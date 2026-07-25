export const dynamic = "force-dynamic";

import { eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { created, fail, handleApiError } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, permissions, rolePermissions, roles } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { userCanManageStoreEmployees } from "@/lib/rbac";
import { filterStorePermissionCodes } from "@/lib/permission-scopes";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ storeId: z.string().uuid().optional(), name: z.string().min(2), description: z.string().optional(), permissionCodes: z.array(z.string()).default([]) });

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const primaryStore = await getMerchantPrimaryStore(session.userId);
    const storeId = payload.storeId || primaryStore?.id;
    if (!storeId) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, storeId)) return fail("لا تملك الصلاحية", 403);
    if (!(await userCanManageStoreEmployees(session.userId, storeId, "permissions.manage"))) return fail("لا تملك صلاحية إدارة مجموعات الموظفين", 403);

    const groupPermissionCodes = [...new Set(filterStorePermissionCodes(payload.permissionCodes))];
    const result = await db.transaction(async (tx) => {
      const [role] = await tx.insert(roles).values({ name: payload.name, code: `store_group_${storeId.replace(/-/g, "").slice(0, 12)}_${nanoid(8)}`, scope: "store", isSystem: false, description: payload.description || "مجموعة صلاحيات لموظفي المتجر" }).returning();
      const rows = groupPermissionCodes.length ? await tx.select().from(permissions).where(inArray(permissions.code, groupPermissionCodes)) : [];
      if (rows.length) await tx.insert(rolePermissions).values(rows.map((permission) => ({ roleId: role.id, permissionId: permission.id }))).onConflictDoNothing();
      return { role, permissionCodes: groupPermissionCodes };
    });
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "store_employee_group", entityId: result.role.id, afterData: result });
    return created({ ...result, message: "تم إنشاء مجموعة صلاحيات الموظفين" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء مجموعة الصلاحيات");
  }
}
