export const dynamic = "force-dynamic";

import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { scanSuspiciousActivity } from "@/lib/security-monitor";
import { writeAuditLog } from "@/lib/audit";

export async function POST() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    const alerts = await scanSuspiciousActivity();
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "security_scan", afterData: { alertsCreated: alerts.length } });
    return ok({ alerts, message: `تم فحص النشاط المشبوه. تنبيهات جديدة/قائمة: ${alerts.length}` });
  } catch (error) {
    return handleApiError(error, "تعذر فحص النشاط المشبوه");
  }
}
