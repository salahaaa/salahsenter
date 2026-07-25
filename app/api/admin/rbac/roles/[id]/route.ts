export const dynamic = "force-dynamic";

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, permissions, rolePermissions, roles } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { isPlatformPermission, isStorePermission } from "@/lib/permission-scopes";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  permissionCodes: z.array(z.string()).optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "roles.manage");
    const payload = patchSchema.parse(await request.json());
    const [before] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!before) return fail("الدور غير موجود", 404);
    if (before.scope !== "system") return fail("صلاحيات المتاجر تُدار من لوحة التاجر وليس من لوحة الإدارة", 403);
    const scopedPermissionCodes = payload.permissionCodes
      ? payload.permissionCodes.filter((code) => before.scope === "store" ? isStorePermission(code) : isPlatformPermission(code))
      : undefined;

    const result = await db.transaction(async (tx) => {
      const [role] = await tx
        .update(roles)
        .set({ name: payload.name ?? before.name, description: payload.description ?? before.description, updatedAt: new Date() })
        .where(eq(roles.id, id))
        .returning();
      if (scopedPermissionCodes) {
        await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
        if (scopedPermissionCodes.length) {
          const rows = await tx.select().from(permissions).where(inArray(permissions.code, scopedPermissionCodes));
          if (rows.length) await tx.insert(rolePermissions).values(rows.map((p) => ({ roleId: id, permissionId: p.id }))).onConflictDoNothing();
        }
      }
      return { role };
    });
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "role", entityId: id, beforeData: before, afterData: result });
    return ok({ ...result, message: "تم حفظ صلاحيات الدور" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ صلاحيات الدور");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "roles.manage");
    const [role] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
    if (!role) return fail("الدور غير موجود", 404);
    if (role.scope !== "system") return fail("صلاحيات المتاجر تُدار من لوحة التاجر وليس من لوحة الإدارة", 403);
    if (role.isSystem) return fail("لا يمكن حذف دور نظامي", 409);
    await db.delete(roles).where(eq(roles.id, id));
    await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "role", entityId: id, beforeData: role });
    return ok({ message: "تم حذف الدور" });
  } catch (error) {
    return handleApiError(error, "تعذر حذف الدور");
  }
}
