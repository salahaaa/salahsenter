export const dynamic = "force-dynamic";

import { asc, eq } from "drizzle-orm";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, systemSettings } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "system.settings.view");
    const settings = await db.select().from(systemSettings).orderBy(asc(systemSettings.group), asc(systemSettings.key));
    return ok({ settings });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل الإعدادات");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "system.settings.edit");
    const payload = (await request.json()) as { group: string; key: string; value: unknown; isPublic?: boolean };

    const [setting] = await db
      .insert(systemSettings)
      .values({ group: payload.group, key: payload.key, value: payload.value, isPublic: Boolean(payload.isPublic), updatedBy: session.userId })
      .onConflictDoUpdate({
        target: [systemSettings.group, systemSettings.key],
        set: { value: payload.value, isPublic: Boolean(payload.isPublic), updatedBy: session.userId, updatedAt: new Date() }
      })
      .returning();

    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "system_setting", entityId: `${payload.group}.${payload.key}`, afterData: setting });
    return ok({ setting, message: "تم تحديث الإعدادات بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث الإعدادات");
  }
}
