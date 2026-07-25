export const dynamic = "force-dynamic";

import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hashPassword, requireAuth, revokeUserSessions } from "@/lib/auth";
import { db, platformEmployees, users } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { EMPLOYEE_ACCOUNT_STATUSES, isValidUsername, mustRevokeEmployeeSessions, normalizeUsername } from "@/lib/employees/policy";
import { assertAdminEmployeeAction } from "@/lib/rbac";
import { optionalUrlOrPathSchema, strongPasswordSchema } from "@/lib/validators";

const patchSchema = z.object({
  fullName: z.string().trim().min(2).max(160).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  username: z.string().trim().min(3).max(64).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  avatarUrl: optionalUrlOrPathSchema.nullable().optional(),
  employeeNumber: z.string().trim().max(80).optional(),
  jobTitle: z.string().trim().max(140).optional().nullable(),
  departmentGroup: z.string().trim().max(140).optional().nullable(),
  nationalId: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(2_000).optional().nullable(),
  notes: z.string().trim().max(4_000).optional().nullable(),
  hiredAt: z.string().datetime().optional().nullable(),
  status: z.enum(EMPLOYEE_ACCOUNT_STATUSES).optional(),
  newPassword: strongPasswordSchema.optional()
});

async function getEmployee(id: string) {
  const [row] = await db
    .select({ employee: platformEmployees, user: users })
    .from(platformEmployees)
    .innerJoin(users, eq(platformEmployees.userId, users.id))
    .where(eq(platformEmployees.id, id))
    .limit(1);
  return row;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdminEmployeeAction(session, "edit");
    const payload = patchSchema.parse(await request.json());
    const before = await getEmployee(id);
    if (!before) return fail("الموظف غير موجود", 404);
    if (payload.status && payload.status !== "active" && before.user.id === session.userId) return fail("لا يمكن إيقاف حسابك من جلستك الحالية", 409);

    const username = payload.username === undefined ? undefined : normalizeUsername(payload.username);
    if (username !== undefined && !isValidUsername(username)) return fail("اسم المستخدم غير صالح", 422);
    if (payload.email !== undefined || username !== undefined) {
      const [emailDuplicate] = payload.email === undefined
        ? [undefined]
        : await db.select({ id: users.id }).from(users).where(and(eq(users.email, payload.email), ne(users.id, before.user.id))).limit(1);
      const [usernameDuplicate] = username === undefined
        ? [undefined]
        : await db.select({ id: users.id }).from(users).where(and(eq(users.username, username), ne(users.id, before.user.id))).limit(1);
      if (emailDuplicate || usernameDuplicate) return fail("البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل", 409);
    }

    const nextStatus = payload.status || (before.employee.status as (typeof EMPLOYEE_ACCOUNT_STATUSES)[number]);
    const result = await db.transaction(async (tx) => {
      const userPatch: Record<string, unknown> = { updatedAt: new Date() };
      if (payload.fullName !== undefined) userPatch.fullName = payload.fullName;
      if (payload.email !== undefined) userPatch.email = payload.email;
      if (username !== undefined) userPatch.username = username;
      if (payload.phone !== undefined) userPatch.phone = payload.phone;
      if (payload.avatarUrl !== undefined) userPatch.avatarUrl = payload.avatarUrl || null;
      if (payload.status !== undefined) userPatch.status = nextStatus;
      if (payload.newPassword) {
        userPatch.passwordHash = await hashPassword(payload.newPassword);
        userPatch.mustChangePassword = true;
      }
      const [user] = await tx.update(users).set(userPatch).where(eq(users.id, before.user.id)).returning();
      const [employee] = await tx
        .update(platformEmployees)
        .set({
          employeeNumber: payload.employeeNumber ?? before.employee.employeeNumber,
          jobTitle: payload.jobTitle === undefined ? before.employee.jobTitle : payload.jobTitle,
          departmentGroup: payload.departmentGroup === undefined ? before.employee.departmentGroup : payload.departmentGroup,
          nationalId: payload.nationalId === undefined ? before.employee.nationalId : payload.nationalId,
          address: payload.address === undefined ? before.employee.address : payload.address,
          notes: payload.notes === undefined ? before.employee.notes : payload.notes,
          hiredAt: payload.hiredAt === undefined ? before.employee.hiredAt : payload.hiredAt ? new Date(payload.hiredAt) : null,
          status: nextStatus,
          updatedAt: new Date()
        })
        .where(eq(platformEmployees.id, id))
        .returning();
      return { employee, user };
    });

    if (mustRevokeEmployeeSessions(nextStatus)) await revokeUserSessions(before.user.id, { excludeSessionId: null });
    await writeAuditLog({
      actorId: session.userId,
      action: payload.status === undefined ? "update" : "status_change",
      entityType: payload.status === undefined ? "employee.platform.update" : "employee.platform.status_change",
      entityId: id,
      beforeData: before,
      afterData: result
    });
    return ok({ employee: result.employee, user: { id: result.user.id, email: result.user.email, username: result.user.username, fullName: result.user.fullName, status: result.user.status }, message: "تم تحديث بيانات الموظف" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث موظف المنصة");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdminEmployeeAction(session, "delete");
    const before = await getEmployee(id);
    if (!before) return fail("الموظف غير موجود", 404);
    if (before.user.id === session.userId) return fail("لا يمكن إلغاء تفعيل حسابك من جلستك الحالية", 409);

    const [employee] = await db.update(platformEmployees).set({ status: "inactive", updatedAt: new Date() }).where(eq(platformEmployees.id, id)).returning();
    await db.update(users).set({ status: "inactive", updatedAt: new Date() }).where(eq(users.id, before.user.id));
    const revokedSessions = await revokeUserSessions(before.user.id);
    await writeAuditLog({
      actorId: session.userId,
      action: "status_change",
      entityType: "employee.platform.inactivated",
      entityId: id,
      beforeData: before,
      afterData: { employee, userStatus: "inactive", revokedSessions }
    });
    return ok({ message: "تم إلغاء تفعيل الموظف فوراً مع الاحتفاظ بجميع بياناته وصلاحياته", revokedSessions });
  } catch (error) {
    return handleApiError(error, "تعذر إلغاء تفعيل موظف المنصة");
  }
}
