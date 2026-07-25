export const dynamic = "force-dynamic";

import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { getPlatformAiInsights } from "@/lib/ai/platform-monitor";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "reports.view");
    return ok(await getPlatformAiInsights());
  } catch (error) {
    return handleApiError(error, "تعذر توليد تنبيهات مساعد المنصة");
  }
}
