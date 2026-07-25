export const dynamic = "force-dynamic";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, notifications, systemSettings } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { defaultSecuritySettings, getPlatformSecuritySettings, normalizeSecuritySettings } from "@/lib/security-settings";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  emergencyLockdown: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  securityLevel: z.enum(["normal", "heightened", "lockdown"]).optional(),
  messageTitle: z.string().optional(),
  messageBody: z.string().optional(),
  reason: z.string().optional(),
  disabledModules: z.object({
    orders: z.boolean().optional(),
    merchantApplications: z.boolean().optional(),
    uploads: z.boolean().optional(),
    registrations: z.boolean().optional()
  }).optional()
});

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    return ok({ settings: await getPlatformSecuritySettings() });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل إعدادات الحماية");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    const before = await getPlatformSecuritySettings();
    const payload = schema.parse(await request.json());
    const settings = normalizeSecuritySettings({
      ...before,
      ...payload,
      disabledModules: { ...before.disabledModules, ...(payload.disabledModules || {}) },
      updatedAt: new Date().toISOString(),
      updatedBy: session.userId
    });

    const [setting] = await db
      .insert(systemSettings)
      .values({ group: "security", key: "platform_guard", value: settings, isPublic: false, updatedBy: session.userId })
      .onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value: settings, updatedBy: session.userId, updatedAt: new Date() } })
      .returning();

    await db.insert(notifications).values({
      userId: session.userId,
      title: settings.emergencyLockdown ? "تم تفعيل إيقاف المنصة" : "تم تحديث إعدادات حماية المنصة",
      body: settings.reason || settings.messageBody || "تم تحديث وضع الحماية",
      type: "platform_security_updated",
      data: settings as Record<string, unknown>
    });

    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "platform_security", entityId: "platform_guard", beforeData: before, afterData: settings });
    return ok({ settings, setting, message: settings.emergencyLockdown ? "تم إيقاف المنصة فوراً" : "تم تحديث إعدادات الحماية" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث إعدادات الحماية");
  }
}

export async function DELETE() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    const settings = { ...defaultSecuritySettings, updatedAt: new Date().toISOString(), updatedBy: session.userId };
    const [setting] = await db
      .insert(systemSettings)
      .values({ group: "security", key: "platform_guard", value: settings, isPublic: false, updatedBy: session.userId })
      .onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value: settings, updatedBy: session.userId, updatedAt: new Date() } })
      .returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "platform_security", entityId: "platform_guard", afterData: settings });
    return ok({ settings, setting, message: "تم إعادة تشغيل المنصة" });
  } catch (error) {
    return handleApiError(error, "تعذر إعادة تشغيل المنصة");
  }
}
