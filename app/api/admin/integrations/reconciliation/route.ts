export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";
import { getReconciliationDashboardData } from "@/lib/integrations/accounting/reliability";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "system.erp.manage");
    return ok(await getReconciliationDashboardData());
  } catch (error) {
    return handleApiError(error, "تعذر تحميل Reconciliation Dashboard");
  }
}
