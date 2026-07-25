export const dynamic = "force-dynamic";

import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { getProductionReadiness } from "@/lib/production/readiness";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "reports.view");
    return ok(await getProductionReadiness());
  } catch (error) {
    return handleApiError(error, "تعذر تحميل جاهزية الإنتاج");
  }
}
