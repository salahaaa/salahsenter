export const dynamic = "force-dynamic";

import { sql } from "drizzle-orm";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, stores, users, products, merchantApplications } from "@/lib/db";
import { getDatabaseUrl, getDatabaseUrlDiagnostics, maskDatabaseUrl } from "@/lib/db/env";
import { assertAdmin } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    const databaseUrl = getDatabaseUrl();
    const [ping, usersCount, storesCount, productsCount, appsCount] = await Promise.all([
      db.execute(sql`select now() as now`),
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(stores),
      db.select({ count: sql<number>`count(*)::int` }).from(products),
      db.select({ count: sql<number>`count(*)::int` }).from(merchantApplications)
    ]);

    return ok({
      databaseConfigured: Boolean(databaseUrl),
      databaseUrl: maskDatabaseUrl(databaseUrl),
      diagnostics: getDatabaseUrlDiagnostics(),
      ping: ping[0] || null,
      counts: {
        users: usersCount[0]?.count || 0,
        stores: storesCount[0]?.count || 0,
        products: productsCount[0]?.count || 0,
        merchantApplications: appsCount[0]?.count || 0
      },
      message: "اتصال قاعدة البيانات يعمل وهذه هي البيانات المقروءة فعلياً من نفس الاتصال الذي تستخدمه الواجهات"
    });
  } catch (error) {
    return handleApiError(error, "فشل فحص قاعدة البيانات");
  }
}
