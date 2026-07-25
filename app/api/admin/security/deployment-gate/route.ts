export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { getAdminProtectionSnapshot, writeStructuredLog } from "@/lib/admin/platform-protection-center";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    const snapshot = await getAdminProtectionSnapshot({ persist: true });
    await writeStructuredLog({ level: snapshot.deploymentGate.allowed ? "info" : "critical", category: "deployment_gate", service: "deployment", message: snapshot.deploymentGate.allowed ? "Deployment gate allowed" : "Deployment gate blocked", actorId: session.userId, metadata: snapshot.deploymentGate });
    return ok({ deploymentGate: snapshot.deploymentGate, score: snapshot.score, grade: snapshot.grade });
  } catch (error) {
    return handleApiError(error, "تعذر تشغيل حماية النشر");
  }
}
