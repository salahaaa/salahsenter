export const dynamic = "force-dynamic";

import bcrypt from "bcryptjs";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { db, platformOwnerAccounts, prelaunchResetRuns, userRoles, users } from "@/lib/db";
import { bootstrapCookieName, hashOpaqueToken, requireSuperAdminRoleId } from "@/lib/sensitive-control";

const ownerSchema = z.object({ fullName: z.string().trim().min(2).max(160), email: z.string().trim().toLowerCase().email(), password: z.string().min(16).max(128) });
const schema = z.object({ owners: z.tuple([ownerSchema, ownerSchema]) }).superRefine((value, ctx) => {
  if (value.owners[0].email === value.owners[1].email) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["owners"], message: "يجب أن يكون بريدا المالكين مختلفين." });
  for (const [index, owner] of value.owners.entries()) if (/demo|example|change.?me|replace/i.test(owner.password)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["owners", index, "password"], message: "كلمة مرور تجريبية غير مسموح بها." });
});

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(bootstrapCookieName())?.value;
    if (!token) return fail("لا توجد تذكرة Bootstrap صالحة. نفذ تصفية ما قبل الإطلاق من مركز التحكم الحساس أولاً.", 403);
    const payload = schema.parse(await request.json());
    const tokenHash = hashOpaqueToken(token);
    const [run] = await db.select().from(prelaunchResetRuns).where(and(eq(prelaunchResetRuns.bootstrapTokenHash, tokenHash), eq(prelaunchResetRuns.status, "bootstrap_pending"), isNull(prelaunchResetRuns.bootstrapConsumedAt), gt(prelaunchResetRuns.bootstrapExpiresAt, new Date()))).limit(1);
    if (!run) return fail("انتهت أو استهلكت تذكرة Bootstrap. أعد العملية من مركز التحكم الحساس.", 403);

    const result = await db.transaction(async (tx) => {
      const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(users);
      if (Number(count) > 0) throw Object.assign(new Error("لا يمكن Bootstrap بينما توجد حسابات نشطة أو متبقية."), { statusCode: 409 });
      const superAdminRoleId = await requireSuperAdminRoleId(tx);
      const createdOwners = [];
      for (const [index, owner] of payload.owners.entries()) {
        const [user] = await tx.insert(users).values({ fullName: owner.fullName, email: owner.email, passwordHash: await bcrypt.hash(owner.password, 12), status: "active", emailVerifiedAt: new Date(), mustChangePassword: true, isTestAccount: false }).returning();
        await tx.insert(userRoles).values({ userId: user.id, roleId: superAdminRoleId });
        await tx.insert(platformOwnerAccounts).values({ slot: index + 1, userId: user.id, emailSnapshot: user.email, status: "active" });
        createdOwners.push({ id: user.id, email: user.email, slot: index + 1 });
      }
      await tx.update(prelaunchResetRuns).set({ status: "completed", bootstrapConsumedAt: new Date(), completedAt: new Date(), updatedAt: new Date() }).where(eq(prelaunchResetRuns.id, run.id));
      return createdOwners;
    });
    cookieStore.delete(bootstrapCookieName());
    return ok({ owners: result, message: "تم إنشاء حسابي المالك. سجّل الدخول بأحدهما ثم هيئ كلمة مرور مركز التحكم الحساس قبل إعادة فتح المنصة." });
  } catch (error) { return handleApiError(error, "تعذر إنشاء حسابي المالك بعد التصفية"); }
}
