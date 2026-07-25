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
    const snapshot = await getAdminProtectionSnapshot();
    return ok({ snapshot });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل مركز حماية المنصة");
  }
}

export async function POST() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    const snapshot = await getAdminProtectionSnapshot({ persist: true });
    await writeStructuredLog({ level: "info", category: "monitoring", service: "security_center", message: "تم حفظ لقطة مراقبة من الأدمن", actorId: session.userId, metadata: { score: snapshot.score, grade: snapshot.grade } });
    return ok({ snapshot, message: "تم تحديث وحفظ فحص مركز الحماية" });
  } catch (error) {
    return handleApiError(error, "تعذر تشغيل فحص مركز الحماية");
  }
}
