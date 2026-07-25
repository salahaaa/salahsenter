export const dynamic = "force-dynamic";

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, permissions, rolePermissions, roles } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { isPlatformPermission, isStorePermission } from "@/lib/permission-scopes";

const roleSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  scope: z.enum(["system", "store"]).default("system"),
  description: z.string().optional(),
  permissionCodes: z.array(z.string()).default([])
});

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "roles.manage");
    const [roleItems, permissionItems, assignments] = await Promise.all([
      db.select().from(roles).orderBy(roles.scope, roles.name),
      db.select().from(permissions).orderBy(permissions.group, permissions.code),
      db
        .select({ roleId: rolePermissions.roleId, permissionCode: permissions.code })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    ]);
    return ok({ roles: roleItems, permissions: permissionItems, assignments });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل الصلاحيات");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "roles.manage");
    const payload = roleSchema.parse(await request.json());
    if (payload.scope !== "system") return fail("أدوار وصلاحيات المتاجر تُدار من لوحة التاجر وليس من لوحة الإدارة", 403);

    const result = await db.transaction(async (tx) => {
      const [role] = await tx
        .insert(roles)
        .values({ name: payload.name, code: payload.code, scope: payload.scope, description: payload.description, isSystem: false })
        .returning();
      const allowedCodes = payload.permissionCodes.filter((code) => payload.scope === "store" ? isStorePermission(code) : isPlatformPermission(code));
      if (allowedCodes.length) {
        const rows = await tx.select().from(permissions).where(inArray(permissions.code, allowedCodes));
        if (rows.length) await tx.insert(rolePermissions).values(rows.map((p) => ({ roleId: role.id, permissionId: p.id }))).onConflictDoNothing();
      }
      return { role };
    });
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "role", entityId: result.role.id, afterData: result });
    return created({ ...result, message: "تم إنشاء الدور وحفظ الصلاحيات" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء الدور");
  }
}
