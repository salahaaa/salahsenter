export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth, revokeUserSessions } from "@/lib/auth";
import { db, platformOwnerAccounts, userRoles, users } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { assertEligibleSensitiveAdmin, requireSensitiveUnlock, requireSuperAdminRoleId } from "@/lib/sensitive-control";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ fullName: z.string().trim().min(2).max(160), email: z.string().trim().toLowerCase().email(), password: z.string().min(16).max(128) }).superRefine((value, ctx) => { if (/demo|example|change.?me|replace/i.test(value.password)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: "كلمة مرور تجريبية غير مسموح بها." }); });

export async function PATCH(request: Request, context: { params: Promise<{ slot: string }> }) {
  try {
    const { slot } = await context.params;
    const slotNumber = Number(slot);
    if (![1, 2].includes(slotNumber)) return fail("رقم مالك المنصة غير صحيح.", 422);
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    await assertEligibleSensitiveAdmin(session.userId);
    await requireSensitiveUnlock(session.userId);
    const payload = schema.parse(await request.json());
    const [before] = await db.select().from(platformOwnerAccounts).where(and(eq(platformOwnerAccounts.slot, slotNumber), eq(platformOwnerAccounts.status, "active"))).limit(1);
    if (!before && slotNumber === 1) return fail("المالك الأساسي غير موجود.", 404);
    if (before?.userId === session.userId) return fail("لا يمكن استبدال الحساب الذي فتح جلسة التحكم الحساس الحالية. استخدم المالك الثاني أولاً.", 409);
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, payload.email)).limit(1);
      if (existing) throw Object.assign(new Error("البريد البديل مستخدم بالفعل."), { statusCode: 409 });
      const roleId = await requireSuperAdminRoleId(tx);
      const [replacement] = await tx.insert(users).values({ fullName: payload.fullName, email: payload.email, passwordHash: await bcrypt.hash(payload.password, 12), status: "active", emailVerifiedAt: new Date(), mustChangePassword: true, isTestAccount: false }).returning();
      await tx.insert(userRoles).values({ userId: replacement.id, roleId });
      let owner;
      let disabledUserId: string | null = null;
      if (before) {
        await revokeUserSessions(before.userId, { tx });
        await tx.update(users).set({ status: "suspended", updatedAt: new Date() }).where(eq(users.id, before.userId));
        [owner] = await tx.update(platformOwnerAccounts).set({ userId: replacement.id, emailSnapshot: replacement.email, replacedAt: new Date(), updatedAt: new Date() }).where(eq(platformOwnerAccounts.id, before.id)).returning();
        disabledUserId = before.userId;
      } else {
        [owner] = await tx.insert(platformOwnerAccounts).values({ slot: slotNumber, userId: replacement.id, emailSnapshot: replacement.email, status: "active" }).returning();
      }
      return { owner, replacement, disabledUserId };
    });
    await writeAuditLog({ actorId: session.userId, action: "update", category: "administrative", entityType: "platform_owner_account_replace", entityId: before?.id || result.owner.id, beforeData: before || null, afterData: result });
    return ok({ ...result, message: before ? "تم تعطيل الحساب السابق وإلغاء جلساته واستبداله بالبريد الجديد." : "تم إعداد حساب المالك الثاني المستقل." });
  } catch (error) { return handleApiError(error, "تعذر استبدال حساب المالك"); }
}
