export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { desc } from "drizzle-orm";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, integrationSyncRuns } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "system.integrations.manage");
    const syncRuns = await db.select().from(integrationSyncRuns).orderBy(desc(integrationSyncRuns.startedAt)).limit(200);
    return ok({ syncRuns });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل Sync Runs");
  }
}
