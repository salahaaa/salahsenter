export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { getCentralMonitoringSnapshot } from "@/lib/observability/central-monitoring";
import { writeStructuredLog } from "@/lib/admin/platform-protection-center";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "reports.view");
    const snapshot = await getCentralMonitoringSnapshot();
    return ok({ snapshot });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل نظام المراقبة المركزي");
  }
}

export async function POST() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "reports.view");
    const snapshot = await getCentralMonitoringSnapshot({ persist: true });
    await writeStructuredLog({ level: "info", category: "central_monitoring", service: "observability", message: "تم حفظ لقطة Central Monitoring من الأدمن", actorId: session.userId, metadata: { score: snapshot.health.score, grade: snapshot.health.grade } });
    return ok({ snapshot, message: "تم تحديث وحفظ لقطة المراقبة المركزية" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث نظام المراقبة المركزي");
  }
}
