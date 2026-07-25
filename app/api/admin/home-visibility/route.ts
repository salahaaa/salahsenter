export const dynamic = "force-dynamic";

import { revalidatePath } from "next/cache";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, systemSettings } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { getHomeVisibilityRules, normalizeHomeVisibilityRules } from "@/lib/home-visibility";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "home.manage");
    return ok({ rules: await getHomeVisibilityRules() });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل قواعد ظهور الصفحة الرئيسية");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "home.manage");
    // Preserve forward-compatible nested rules (fairness, ranking, seasonal, pinned content) while normalizing defaults.
    const rawPayload = await request.json();
    const payload = normalizeHomeVisibilityRules(rawPayload);
    const [setting] = await db
      .insert(systemSettings)
      .values({ group: "homepage", key: "visibility_rules", value: payload, isPublic: false, updatedBy: session.userId })
      .onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value: payload, updatedBy: session.userId, updatedAt: new Date() } })
      .returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "homepage_visibility_rules", entityId: "visibility_rules", afterData: setting });
    revalidatePath("/");
    return ok({ rules: payload, message: "تم حفظ قواعد ظهور الصفحة الرئيسية" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ قواعد ظهور الصفحة الرئيسية");
  }
}
