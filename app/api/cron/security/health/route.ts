export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fail, handleApiError, ok } from "@/lib/api";
import { getCronAuthorizationStatus } from "@/lib/cron/auth";
import { getAdminProtectionSnapshot, sendSmartAlert, writeStructuredLog } from "@/lib/admin/platform-protection-center";

export async function GET(request: Request) {
  try {
    const auth = getCronAuthorizationStatus(request);
    if (!auth.ok) return fail(auth.message, auth.status);
    const snapshot = await getAdminProtectionSnapshot({ persist: true });
    if (snapshot.grade === "Critical" || snapshot.score < 55) {
      await sendSmartAlert({ severity: "critical", title: "مركز الحماية رصد حالة حرجة", message: `Health score=${snapshot.score}% / ${snapshot.statusLabel}. راجع لوحة الأدمن فوراً.`, metadata: { score: snapshot.score, grade: snapshot.grade } });
    }
    await writeStructuredLog({ level: snapshot.score < 55 ? "critical" : snapshot.score < 75 ? "warn" : "info", category: "cron_health_check", service: "security_center", message: `Security center cron check score=${snapshot.score}`, metadata: { score: snapshot.score, grade: snapshot.grade } });
    return ok({ score: snapshot.score, grade: snapshot.grade, incidents: snapshot.incidents.length, alerts: snapshot.alerts.length });
  } catch (error) {
    return handleApiError(error, "تعذر تشغيل فحص مركز الحماية الدوري");
  }
}
