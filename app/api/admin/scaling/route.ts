export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { getAutoScalingSnapshot } from "@/lib/scaling/auto-scaling-intelligence";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    return ok({ snapshot: await getAutoScalingSnapshot() });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل Auto Scaling Intelligence");
  }
}

export async function POST() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    return ok({ snapshot: await getAutoScalingSnapshot({ persistRecommendation: true }), message: "تم تقييم وحفظ توصية التوسع" });
  } catch (error) {
    return handleApiError(error, "تعذر تقييم Auto Scaling Intelligence");
  }
}
