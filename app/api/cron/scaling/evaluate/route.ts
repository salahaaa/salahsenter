export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fail, handleApiError, ok } from "@/lib/api";
import { getCronAuthorizationStatus } from "@/lib/cron/auth";
import { applyAutoScalingDecision, getAutoScalingSnapshot } from "@/lib/scaling/auto-scaling-intelligence";

function flag(value: string | undefined) {
  return ["1", "true", "yes", "on", "enabled"].includes(String(value || "").toLowerCase());
}

export async function GET(request: Request) {
  try {
    const auth = getCronAuthorizationStatus(request);
    if (!auth.ok) return fail(auth.message, auth.status);
    if (flag(process.env.AUTO_SCALING_AUTOPILOT)) {
      const result = await applyAutoScalingDecision({ mode: "auto" });
      return ok({ autopilot: true, message: result.message, decision: result.snapshot.decision, providerResponse: result.providerResponse });
    }
    const snapshot = await getAutoScalingSnapshot({ persistRecommendation: true });
    return ok({ autopilot: false, message: "تم حفظ توصية التوسع فقط؛ فعّل AUTO_SCALING_AUTOPILOT للتطبيق التلقائي", decision: snapshot.decision });
  } catch (error) {
    return handleApiError(error, "تعذر تشغيل Cron Auto Scaling");
  }
}
