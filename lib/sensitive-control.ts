import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import {
  db,
  platformOwnerAccounts,
  platformSensitiveControlSessions,
  platformSensitiveControlSettings,
  roles,
  userRoles,
  users
} from "@/lib/db";
import { ApiError, ForbiddenError } from "@/lib/api";

const SENSITIVE_COOKIE = "platform_sensitive_unlock";
const sensitiveTtlMs = 10 * 60 * 1000;

export function hashOpaqueToken(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function assertSensitivePasswordPolicy(value: string) {
  if (value.length < 16) throw new ApiError("كلمة مرور مركز التحكم الحساس يجب أن تكون 16 حرفاً على الأقل.", 422);
  if (/demo|example|change.?me|replace/i.test(value)) throw new ApiError("كلمة المرور تبدو تجريبية أو افتراضية وغير مسموح بها.", 422);
}

export async function getSensitiveControlSettings() {
  const [settings] = await db.select().from(platformSensitiveControlSettings).limit(1);
  return settings || null;
}

export async function getOwnerByUserId(userId: string, tx: any = db) {
  const [owner] = await tx.select().from(platformOwnerAccounts).where(and(eq(platformOwnerAccounts.userId, userId), eq(platformOwnerAccounts.status, "active"))).limit(1);
  return owner || null;
}

export async function assertEligibleSensitiveAdmin(userId: string, tx: any = db) {
  const [user] = await tx.select({ id: users.id, isTestAccount: users.isTestAccount, status: users.status }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.status !== "active") throw new ForbiddenError("الحساب غير نشط.");
  if (user.isTestAccount) throw new ForbiddenError("حسابات الاختبار لا تستطيع الدخول إلى مركز التحكم الحساس.");
  const [superAdmin] = await tx
    .select({ id: userRoles.id })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(userRoles.userId, userId), eq(roles.code, "super_admin")))
    .limit(1);
  if (!superAdmin) throw new ForbiddenError("يتطلب مركز التحكم الحساس صلاحية مالك/مسؤول منصة.");
  return user;
}

export async function initializeSensitiveControl(input: { userId: string; password: string; tx?: any }) {
  const tx = input.tx || db;
  await assertEligibleSensitiveAdmin(input.userId, tx);
  assertSensitivePasswordPolicy(input.password);
  const [existing] = await tx.select({ id: platformSensitiveControlSettings.id }).from(platformSensitiveControlSettings).limit(1);
  if (existing) throw new ApiError("تم تهيئة مركز التحكم الحساس بالفعل.", 409);
  const [settings] = await tx.insert(platformSensitiveControlSettings).values({ passwordHash: await bcrypt.hash(input.password, 12), initializedBy: input.userId }).returning();
  const [owner] = await tx.select({ id: platformOwnerAccounts.id }).from(platformOwnerAccounts).where(eq(platformOwnerAccounts.userId, input.userId)).limit(1);
  if (!owner) {
    const [existingSlot] = await tx.select({ id: platformOwnerAccounts.id }).from(platformOwnerAccounts).where(eq(platformOwnerAccounts.slot, 1)).limit(1);
    if (existingSlot) throw new ApiError("يوجد مالك أساسي مختلف؛ استخدم حساب المالك أو مسار الاستبدال.", 409);
    const [user] = await tx.select({ email: users.email }).from(users).where(eq(users.id, input.userId)).limit(1);
    await tx.insert(platformOwnerAccounts).values({ slot: 1, userId: input.userId, emailSnapshot: user?.email || "unknown" });
  }
  return settings;
}

export async function createSensitiveUnlockSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + sensitiveTtlMs);
  await db.insert(platformSensitiveControlSessions).values({ ownerUserId: userId, tokenHash, expiresAt });
  const cookieStore = await cookies();
  cookieStore.set(SENSITIVE_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: Math.floor(sensitiveTtlMs / 1000) });
  return { expiresAt };
}

export async function clearSensitiveUnlockSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SENSITIVE_COOKIE);
}

export async function requireSensitiveUnlock(userId: string) {
  const owner = await getOwnerByUserId(userId);
  if (!owner) throw new ForbiddenError("هذا الحساب ليس أحد مالكي المنصة المعتمدين.");
  const cookieStore = await cookies();
  const token = cookieStore.get(SENSITIVE_COOKIE)?.value;
  if (!token) throw new ForbiddenError("افتح مركز التحكم الحساس بإدخال كلمة المرور أولاً.");
  const tokenHash = hashOpaqueToken(token);
  const [session] = await db.select().from(platformSensitiveControlSessions).where(and(eq(platformSensitiveControlSessions.ownerUserId, userId), eq(platformSensitiveControlSessions.tokenHash, tokenHash), gt(platformSensitiveControlSessions.expiresAt, new Date()))).limit(1);
  if (!session) throw new ForbiddenError("انتهت جلسة التحكم الحساس؛ أدخل كلمة المرور مجدداً.");
  await db.update(platformSensitiveControlSessions).set({ lastUsedAt: new Date() }).where(eq(platformSensitiveControlSessions.id, session.id));
  return session;
}

export async function verifySensitivePassword(password: string) {
  const settings = await getSensitiveControlSettings();
  if (!settings) throw new ApiError("مركز التحكم الحساس لم يهيأ بعد.", 409);
  return bcrypt.compare(password, settings.passwordHash);
}

export async function requireSuperAdminRoleId(tx: any = db) {
  const [role] = await tx.select().from(roles).where(eq(roles.code, "super_admin")).limit(1);
  if (!role) throw new ApiError("دور super_admin غير موجود؛ طبق migrations وبيانات المرجع أولاً.", 500);
  return role.id;
}

export function bootstrapCookieName() {
  return "prelaunch_owner_bootstrap";
}
