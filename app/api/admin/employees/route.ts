export const dynamic = "force-dynamic";

import { asc, eq, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hashPassword, requireAuth } from "@/lib/auth";
import { db, platformEmployees, roles, userRoles, users } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { EMPLOYEE_ACCOUNT_STATUSES, isValidUsername, normalizeUsername } from "@/lib/employees/policy";
import { assertAdminEmployeeAction } from "@/lib/rbac";
import { optionalUrlOrPathSchema, strongPasswordSchema } from "@/lib/validators";

const employeeSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email(),
  username: z.string().trim().min(3).max(64),
  phone: z.string().trim().max(40).optional(),
  password: strongPasswordSchema,
  employeeNumber: z.string().trim().max(80).optional(),
  jobTitle: z.string().trim().max(140).optional(),
  departmentGroup: z.string().trim().max(140).optional(),
  avatarUrl: optionalUrlOrPathSchema,
  nationalId: z.string().trim().max(80).optional(),
  address: z.string().trim().max(2_000).optional(),
  notes: z.string().trim().max(4_000).optional(),
  hiredAt: z.string().datetime().optional().nullable(),
  status: z.enum(EMPLOYEE_ACCOUNT_STATUSES).default("active")
});

function employeeIdentityRoleCode() {
  return `platform_employee_${nanoid(14)}`;
}

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminEmployeeAction(session, "view");
    const employees = await db
      .select({
        id: platformEmployees.id,
        userId: users.id,
        fullName: users.fullName,
        email: users.email,
        username: users.username,
        avatarUrl: users.avatarUrl,
        phone: users.phone,
        employeeNumber: platformEmployees.employeeNumber,
        jobTitle: platformEmployees.jobTitle,
        departmentGroup: platformEmployees.departmentGroup,
        nationalId: platformEmployees.nationalId,
        address: platformEmployees.address,
        notes: platformEmployees.notes,
        hiredAt: platformEmployees.hiredAt,
        status: platformEmployees.status,
        groupRoleId: platformEmployees.groupRoleId,
        createdAt: platformEmployees.createdAt
      })
      .from(platformEmployees)
      .innerJoin(users, eq(platformEmployees.userId, users.id))
      .orderBy(asc(users.fullName));
    return ok({ employees });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل موظفي المنصة");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminEmployeeAction(session, "create");
    const payload = employeeSchema.parse(await request.json());
    const username = normalizeUsername(payload.username);
    if (!isValidUsername(username)) return fail("اسم المستخدم يجب أن يبدأ بحرف أو رقم ويحتوي 3–64 حرفاً إنجليزياً/رقماً أو . _ -", 422);

    const [duplicate] = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.email, payload.email), eq(users.username, username)))
      .limit(1);
    if (duplicate) return fail("البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل", 409);

    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          fullName: payload.fullName,
          email: payload.email,
          username,
          avatarUrl: payload.avatarUrl || null,
          phone: payload.phone || null,
          passwordHash: await hashPassword(payload.password),
          mustChangePassword: true,
          status: payload.status,
          emailVerifiedAt: new Date()
        })
        .returning();

      // Identity role only: it carries zero permissions. This keeps the account
      // addressable in its correct dashboard scope without granting access.
      const [identityRole] = await tx
        .insert(roles)
        .values({
          name: `هوية موظف منصة - ${payload.fullName}`,
          code: employeeIdentityRoleCode(),
          scope: "system",
          isSystem: false,
          description: "دور هوية بدون صلاحيات افتراضية لموظف منصة"
        })
        .returning();
      await tx.insert(userRoles).values({ userId: user.id, roleId: identityRole.id });

      const [employee] = await tx
        .insert(platformEmployees)
        .values({
          userId: user.id,
          directRoleId: identityRole.id,
          employeeNumber: payload.employeeNumber || `ADM-${nanoid(8).toUpperCase()}`,
          jobTitle: payload.jobTitle || null,
          departmentGroup: payload.departmentGroup || null,
          nationalId: payload.nationalId || null,
          address: payload.address || null,
          notes: payload.notes || null,
          hiredAt: payload.hiredAt ? new Date(payload.hiredAt) : null,
          status: payload.status
        })
        .returning();
      return { employee, user: { id: user.id, email: user.email, username: user.username, fullName: user.fullName, status: user.status } };
    });

    await writeAuditLog({
      actorId: session.userId,
      action: "create",
      entityType: "employee.platform.create",
      entityId: result.employee.id,
      afterData: { ...result, permissionsGranted: [] }
    });
    return created({ ...result, message: "تم إنشاء حساب الموظف بدون أي صلاحيات افتراضية. انتقل إلى إدارة الصلاحيات لمنح الوصول." });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء موظف المنصة");
  }
}
