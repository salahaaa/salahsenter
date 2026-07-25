export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { executePrelaunchPurge } from "@/lib/prelaunch-reset";
import { assertEligibleSensitiveAdmin, bootstrapCookieName, requireSensitiveUnlock, verifySensitivePassword } from "@/lib/sensitive-control";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  passwords: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
  acknowledged: z.literal(true)
});

/** Destructive pre-launch reset. It uses three independent password entries,
 * a short sensitive session, audit, and a one-time bootstrap cookie. */
export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    await assertEligibleSensitiveAdmin(session.userId);
    await requireSensitiveUnlock(session.userId);
    const payload = schema.parse(await request.json());
    const results = await Promise.all(payload.passwords.map((password) => verifySensitivePassword(password)));
    if (results.some((valid) => !valid)) return fail("يجب إدخال كلمة مرور مركز التحكم الحساس الصحيحة في المرات الثلاث.", 403);

    const result = await executePrelaunchPurge({ initiatedBy: session.userId });
    const cookieStore = await cookies();
    cookieStore.set(bootstrapCookieName(), result.bootstrapToken, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 15 * 60 });
    await writeAuditLog({ actorId: null, action: "delete", category: "administrative", entityType: "prelaunch_operational_data_purge", entityId: result.run.id, afterData: { purgeSummary: result.preview, status: result.run.status } });
    return ok({ message: "تمت تصفية بيانات ما قبل الإطلاق. أنشئ الآن حسابي المالك من صفحة bootstrap خلال 15 دقيقة.", bootstrapPath: "/bootstrap-owner", purgeSummary: result.preview });
  } catch (error) { return handleApiError(error, "تعذر تنفيذ تصفية بيانات ما قبل الإطلاق"); }
}
