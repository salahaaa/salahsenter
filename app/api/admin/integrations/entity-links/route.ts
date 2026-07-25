export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { desc } from "drizzle-orm";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, integrationEntityLinks } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "system.integrations.manage");
    const links = await db.select().from(integrationEntityLinks).orderBy(desc(integrationEntityLinks.updatedAt)).limit(200);
    return ok({ links });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل Entity Links");
  }
}
