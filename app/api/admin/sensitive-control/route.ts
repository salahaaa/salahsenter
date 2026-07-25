export const dynamic = "force-dynamic";

import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { getPrelaunchPurgePreview } from "@/lib/prelaunch-reset";
import { db, stores, systemSettings } from "@/lib/db";
import { assertEligibleSensitiveAdmin, clearSensitiveUnlockSession, createSensitiveUnlockSession, getOwnerByUserId, getSensitiveControlSettings, initializeSensitiveControl, requireSensitiveUnlock, verifySensitivePassword } from "@/lib/sensitive-control";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("initialize"), password: z.string().min(16), passwordConfirm: z.string().min(16) }),
  z.object({ action: z.literal("unlock"), password: z.string().min(1) }),
  z.object({ action: z.literal("lock") }),
  z.object({ action: z.literal("lockdown_platform"), reason: z.string().trim().min(3).max(1_000) }),
  z.object({ action: z.literal("reopen_platform"), reason: z.string().trim().min(3).max(1_000) })
]);

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    await assertEligibleSensitiveAdmin(session.userId);
    const [settings, owner, preview, recentStores] = await Promise.all([getSensitiveControlSettings(), getOwnerByUserId(session.userId), getPrelaunchPurgePreview(), db.select({ id: stores.id, name: stores.name, status: stores.status, isActive: stores.isActive }).from(stores).limit(20)]);
    let unlocked = false;
    if (settings && owner) {
      try { await requireSensitiveUnlock(session.userId); unlocked = true; } catch { unlocked = false; }
    }
    return ok({ initialized: Boolean(settings), isOwner: Boolean(owner), unlocked, preview, recentStores, requiresOwnerInitialization: !settings });
  } catch (error) { return handleApiError(error, "تعذر تحميل مركز التحكم الحساس"); }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    await assertEligibleSensitiveAdmin(session.userId);
    const payload = schema.parse(await request.json());
    if (payload.action === "initialize") {
      if (payload.password !== payload.passwordConfirm) return fail("تأكيد كلمة المرور لا يطابق كلمة المرور الحساسة.", 422);
      await initializeSensitiveControl({ userId: session.userId, password: payload.password });
      const unlocked = await createSensitiveUnlockSession(session.userId);
      return ok({ message: "تمت تهيئة مركز التحكم الحساس وفتح جلسة قصيرة العمر.", expiresAt: unlocked.expiresAt });
    }
    if (payload.action === "unlock") {
      const owner = await getOwnerByUserId(session.userId);
      if (!owner) return fail("هذا الحساب ليس أحد مالكي المنصة المعتمدين.", 403);
      if (!(await verifySensitivePassword(payload.password))) return fail("كلمة مرور مركز التحكم الحساس غير صحيحة.", 403);
      const unlocked = await createSensitiveUnlockSession(session.userId);
      return ok({ message: "تم فتح جلسة التحكم الحساس لمدة قصيرة.", expiresAt: unlocked.expiresAt });
    }
    await requireSensitiveUnlock(session.userId);
    if (payload.action === "lockdown_platform" || payload.action === "reopen_platform") {
      const locked = payload.action === "lockdown_platform";
      const value = locked
        ? { emergencyLockdown: true, maintenanceMode: true, securityLevel: "lockdown", messageTitle: "المنصة متوقفة مؤقتاً", messageBody: "أوقفت الإدارة العمليات العامة مؤقتاً.", disabledModules: { orders: true, merchantApplications: true, uploads: true, registrations: true }, reason: payload.reason }
        : { emergencyLockdown: false, maintenanceMode: false, securityLevel: "normal", messageTitle: "", messageBody: "", disabledModules: { orders: false, merchantApplications: false, uploads: false, registrations: false }, reason: payload.reason };
      await db.insert(systemSettings).values({ group: "security", key: "platform_guard", value, isPublic: false, updatedBy: session.userId }).onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value, updatedBy: session.userId, updatedAt: new Date() } });
      return ok({ message: locked ? "تم قفل التجارة والعمليات العامة في المنصة." : "تمت إعادة فتح العمليات العامة في المنصة." });
    }
    await clearSensitiveUnlockSession();
    return ok({ message: "تم إغلاق جلسة التحكم الحساس." });
  } catch (error) { return handleApiError(error, "تعذر تنفيذ إجراء مركز التحكم الحساس"); }
}
