export const dynamic = "force-dynamic";

import { and, asc, eq, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hashPassword, hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, roles, storeEmployees, userRoles, users } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { writeAuditLog } from "@/lib/audit";
import { EMPLOYEE_ACCOUNT_STATUSES, isValidUsername, normalizeUsername } from "@/lib/employees/policy";
import { userCanManageStoreEmployees } from "@/lib/rbac";
import { assertRentalLimit, lockRentalEntitlement } from "@/lib/rentals/service";
import { isStoreOperational } from "@/lib/store-guards";
import { optionalUrlOrPathSchema, strongPasswordSchema } from "@/lib/validators";

const employeeSchema = z.object({
  storeId: z.string().uuid().optional(),
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email(),
  username: z.string().trim().min(3).max(64),
  phone: z.string().trim().max(40).optional(),
  password: strongPasswordSchema,
  avatarUrl: optionalUrlOrPathSchema,
  employeeCode: z.string().trim().max(80).optional(),
  nationalId: z.string().trim().max(80).optional(),
  jobTitle: z.string().trim().max(140).optional(),
  address: z.string().trim().max(2_000).optional(),
  notes: z.string().trim().max(4_000).optional(),
  hiredAt: z.string().datetime().optional().nullable(),
  status: z.enum(EMPLOYEE_ACCOUNT_STATUSES).default("active")
});

function employeeIdentityRoleCode(storeId: string) {
  return `store_employee_${storeId.replace(/-/g, "").slice(0, 10)}_${nanoid(10)}`;
}

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ employees: [] });
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك الصلاحية", 403);
    if (!(await userCanManageStoreEmployees(session.userId, store.id, "view"))) return fail("لا تملك صلاحية عرض موظفي المتجر", 403);

    const employees = await db
      .select({
        id: storeEmployees.id,
        userId: users.id,
        fullName: users.fullName,
        email: users.email,
        username: users.username,
        avatarUrl: users.avatarUrl,
        phone: users.phone,
        employeeCode: storeEmployees.employeeCode,
        nationalId: storeEmployees.nationalId,
        jobTitle: storeEmployees.jobTitle,
        address: storeEmployees.address,
        notes: storeEmployees.notes,
        hiredAt: storeEmployees.hiredAt,
        status: storeEmployees.status,
        groupRoleId: storeEmployees.groupRoleId,
        createdAt: storeEmployees.createdAt
      })
      .from(storeEmployees)
      .innerJoin(users, eq(storeEmployees.userId, users.id))
      .where(eq(storeEmployees.storeId, store.id))
      .orderBy(asc(users.fullName));
    return ok({ employees });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل موظفي المتجر");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = employeeSchema.parse(await request.json());
    const primaryStore = await getMerchantPrimaryStore(session.userId);
    const storeId = payload.storeId || primaryStore?.id;
    if (!storeId) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, storeId)) return fail("لا تملك الصلاحية", 403);
    if (!(await userCanManageStoreEmployees(session.userId, storeId, "create"))) return fail("لا تملك صلاحية إنشاء موظفي المتجر", 403);
    if (!(await isStoreOperational(storeId))) return fail("المتجر مجمد أو غير مفعل؛ لا يمكن تنفيذ عمليات تشغيلية حتى إعادة فتحه من الأدمن", 403);
    const username = normalizeUsername(payload.username);
    if (!isValidUsername(username)) return fail("اسم المستخدم يجب أن يبدأ بحرف أو رقم ويحتوي 3–64 حرفاً إنجليزياً/رقماً أو . _ -", 422);

    const [duplicate] = await db.select({ id: users.id }).from(users).where(or(eq(users.email, payload.email), eq(users.username, username))).limit(1);
    if (duplicate) return fail("البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل", 409);

    const result = await db.transaction(async (tx) => {
      await lockRentalEntitlement(storeId, tx);
      const [{ count: currentCount }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(storeEmployees)
        .where(eq(storeEmployees.storeId, storeId));
      await assertRentalLimit({ storeId, resource: "employees", currentCount, tx });

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
      const [identityRole] = await tx
        .insert(roles)
        .values({
          name: `هوية موظف متجر - ${payload.fullName}`,
          code: employeeIdentityRoleCode(storeId),
          scope: "store",
          isSystem: false,
          description: "دور هوية بدون صلاحيات افتراضية لموظف متجر"
        })
        .returning();
      await tx.insert(userRoles).values({ userId: user.id, roleId: identityRole.id, storeId });
      const [employee] = await tx
        .insert(storeEmployees)
        .values({
          storeId,
          userId: user.id,
          roleId: identityRole.id,
          employeeCode: payload.employeeCode || null,
          nationalId: payload.nationalId || null,
          jobTitle: payload.jobTitle || null,
          address: payload.address || null,
          notes: payload.notes || null,
          hiredAt: payload.hiredAt ? new Date(payload.hiredAt) : null,
          status: payload.status
        })
        .returning();
      return { employee, user: { id: user.id, email: user.email, username: user.username, fullName: user.fullName, status: user.status } };
    });

    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "employee.store.create", entityId: result.employee.id, afterData: { ...result, storeId, permissionsGranted: [] } });
    return created({ ...result, message: "تم إنشاء حساب الموظف بدون أي صلاحيات افتراضية. انتقل إلى إدارة الصلاحيات لمنح الوصول." });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء موظف المتجر");
  }
}
