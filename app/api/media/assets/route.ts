export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasRole, hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, mediaAssets } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get("storeId");

    if (!hasRole(session, "super_admin")) {
      if (!storeId) return fail("يجب تحديد المتجر لعرض الوسائط", 400);
      if (!hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية عرض وسائط هذا المتجر", 403);
      const assets = await db.select().from(mediaAssets).where(eq(mediaAssets.storeId, storeId)).orderBy(desc(mediaAssets.createdAt)).limit(100);
      return ok({ assets });
    }

    const assets = storeId
      ? await db.select().from(mediaAssets).where(eq(mediaAssets.storeId, storeId)).orderBy(desc(mediaAssets.createdAt)).limit(100)
      : await db.select().from(mediaAssets).orderBy(desc(mediaAssets.createdAt)).limit(100);
    return ok({ assets });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل مكتبة الوسائط");
  }
}
