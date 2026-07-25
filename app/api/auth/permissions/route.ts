export const dynamic = "force-dynamic";

import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { getUserPermissions } from "@/lib/rbac";

/** Current effective permissions for client-side action visibility. API routes remain authoritative. */
export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const storeId = new URL(request.url).searchParams.get("storeId");
    if (storeId && !hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية هذا المتجر", 403);
    const permissions = await getUserPermissions(session.userId, { storeId: storeId || undefined });
    return ok({ permissions, scope: storeId ? "store" : "platform" });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل الصلاحيات الحالية");
  }
}
