import bcrypt from "bcryptjs";
import crypto from "crypto";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies, headers } from "next/headers";
import { db, roles, userRoles, userSessions, users } from "@/lib/db";
import { getPlatformSecuritySettings, isPlatformLocked } from "@/lib/security-settings";
import { ApiError, AuthenticationError, ForbiddenError } from "@/lib/api";

const cookieName = process.env.SESSION_COOKIE_NAME || "mall_session";
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return new TextEncoder().encode(secret);
}

export type SessionRole = {
  code: string;
  scope: "system" | "store";
  storeId: string | null;
};

export type SessionPayload = {
  userId: string;
  email: string;
  fullName: string;
  roles: SessionRole[];
  sessionId?: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getRequestDeviceMetadata() {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || h.get("cf-connecting-ip") || "unknown";
    const userAgent = h.get("user-agent") || "unknown";
    const deviceId = crypto.createHash("sha256").update(`${ip}:${userAgent}`).digest("hex").slice(0, 64);
    return { ipAddress: ip, userAgent, deviceId };
  } catch {
    return { ipAddress: "unknown", userAgent: "unknown", deviceId: "unknown" };
  }
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const result = await jwtVerify(token, getJwtSecret());
    return result.payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/"
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function getCurrentSessionFresh() {
  const session = await getCurrentSession();
  if (!session) return null;
  try {
    const [user] = await db.select({ id: users.id, email: users.email, fullName: users.fullName, status: users.status }).from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user || user.status !== "active") return null;
    if (session.sessionId) {
      const [activeSession] = await db
        .select({ id: userSessions.id })
        .from(userSessions)
        .where(and(eq(userSessions.id, session.sessionId), eq(userSessions.userId, user.id), isNull(userSessions.revokedAt), gt(userSessions.expiresAt, new Date())))
        .limit(1);
      if (!activeSession) return null;
    }
    return { ...session, email: user.email, fullName: user.fullName, roles: await getUserSessionRoles(user.id) };
  } catch {
    return session;
  }
}

export async function getUserSessionRoles(userId: string): Promise<SessionRole[]> {
  const rows = await db
    .select({ code: roles.code, scope: roles.scope, storeId: userRoles.storeId })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  return rows.map((row) => ({ code: row.code, scope: row.scope, storeId: row.storeId }));
}

export async function createSessionForUser(userId: string) {
  const [user] = await db
    .select({ id: users.id, email: users.email, fullName: users.fullName, status: users.status })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.status, "active")))
    .limit(1);

  if (!user) throw new ForbiddenError("المستخدم غير موجود أو غير مفعّل");

  const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 7 * 1000);
  const device = await getRequestDeviceMetadata();
  const [sessionRow] = await db
    .insert(userSessions)
    .values({ userId: user.id, expiresAt, lastSeenAt: new Date(), ...device })
    .returning({ id: userSessions.id });

  const session: SessionPayload = {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: await getUserSessionRoles(user.id),
    sessionId: sessionRow.id
  };

  const token = await signSession(session);
  await db.update(userSessions).set({ tokenHash: hashSessionToken(token), updatedAt: new Date() }).where(eq(userSessions.id, sessionRow.id));
  await setSessionCookie(token);
  return session;
}

export async function requireAuth() {
  const session = await getCurrentSession();
  if (!session) throw new AuthenticationError();

  let activeSession: { id: string; lastSeenAt: Date | null } | undefined;
  if (session.sessionId) {
    [activeSession] = await db
      .select({ id: userSessions.id, lastSeenAt: userSessions.lastSeenAt })
      .from(userSessions)
      .where(and(eq(userSessions.id, session.sessionId), eq(userSessions.userId, session.userId), isNull(userSessions.revokedAt), gt(userSessions.expiresAt, new Date())))
      .limit(1);
    if (!activeSession) throw new AuthenticationError("انتهت الجلسة أو تم تسجيل الخروج من جهاز آخر");
  }

  const [user, freshRoles, settings] = await Promise.all([
    db.select({ id: users.id, email: users.email, fullName: users.fullName, status: users.status }).from(users).where(eq(users.id, session.userId)).limit(1),
    getUserSessionRoles(session.userId),
    getPlatformSecuritySettings()
  ]);
  const currentUser = user[0];
  if (!currentUser || currentUser.status !== "active") throw new ForbiddenError("الحساب غير مفعّل أو موقوف");

  if (session.sessionId && activeSession) {
    const lastSeen = activeSession.lastSeenAt ? new Date(activeSession.lastSeenAt).getTime() : 0;
    if (!lastSeen || Date.now() - lastSeen > 5 * 60 * 1000) {
      await db.update(userSessions).set({ lastSeenAt: new Date(), updatedAt: new Date() }).where(eq(userSessions.id, session.sessionId));
    }
  }

  const freshSession = { ...session, email: currentUser.email, fullName: currentUser.fullName, roles: freshRoles };
  const isAdmin = freshSession.roles.some((role) => role.code === "super_admin");
  if (isPlatformLocked(settings) && !isAdmin) {
    throw new ApiError("المنصة متوقفة مؤقتاً بقرار الإدارة", 503);
  }
  return freshSession;
}

export async function revokeCurrentSession() {
  const session = await getCurrentSession();
  if (session?.sessionId) {
    await db.update(userSessions).set({ revokedAt: new Date(), updatedAt: new Date() }).where(and(eq(userSessions.id, session.sessionId), eq(userSessions.userId, session.userId)));
  }
  await clearSessionCookie();
}

export async function revokeUserSessions(
  userId: string,
  options: { excludeSessionId?: string | null; tx?: any } = {}
) {
  const executor = options.tx || db;
  const conditions = [eq(userSessions.userId, userId), isNull(userSessions.revokedAt)];
  if (options.excludeSessionId) conditions.push(ne(userSessions.id, options.excludeSessionId));
  const revoked = await executor
    .update(userSessions)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(...conditions))
    .returning({ id: userSessions.id });
  return revoked.length;
}

/** Revoke every session for a user and clear the current browser cookie. */
export async function revokeAllUserSessions(userId: string) {
  const count = await revokeUserSessions(userId);
  await clearSessionCookie();
  return count;
}

export function hasRole(session: SessionPayload | null, roleCodes: string | string[]) {
  if (!session) return false;
  const codes = Array.isArray(roleCodes) ? roleCodes : [roleCodes];
  return session.roles.some((role) => codes.includes(role.code));
}

/**
 * A merchant employee may carry a per-store custom group role rather than the
 * legacy literal `store_employee` role. The store-bound assignment is the
 * authority; the individual role code must not become an accidental gate.
 */
export function hasMerchantAccess(session: SessionPayload | null) {
  if (!session) return false;
  return hasRole(session, "super_admin") || session.roles.some((role) => role.scope === "store" && Boolean(role.storeId));
}

export function hasStoreAccess(session: SessionPayload | null, storeId: string) {
  if (!session) return false;
  if (hasRole(session, "super_admin")) return true;
  return session.roles.some((role) => role.storeId === storeId && role.scope === "store");
}
