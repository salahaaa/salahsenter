export const dynamic = "force-dynamic";

import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, systemSettings } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const themeSchema = z.object({
  value: z.record(z.unknown()),
  isPublic: z.boolean().default(true)
});

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "theme.manage");
    const [theme] = await db.select().from(systemSettings).where(and(eq(systemSettings.group, "theme"), eq(systemSettings.key, "global"))).limit(1);
    return ok({ theme: theme?.value || {} });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل إعدادات التصميم");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "theme.manage");
    const payload = themeSchema.parse(await request.json());
    const [theme] = await db
      .insert(systemSettings)
      .values({ group: "theme", key: "global", value: payload.value, isPublic: payload.isPublic, updatedBy: session.userId })
      .onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value: payload.value, isPublic: payload.isPublic, updatedBy: session.userId, updatedAt: new Date() } })
      .returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "theme", entityId: "global", afterData: theme });
    return ok({ theme, message: "تم حفظ الهوية البصرية بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ الهوية البصرية");
  }
}
