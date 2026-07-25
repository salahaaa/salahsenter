export const dynamic = "force-dynamic";

import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { getMerchantAdRecommendations } from "@/lib/ads/recommendations";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ recommendations: [] });
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية هذا المتجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, store.id, ["store.ads.view", Permission.ManageStoreAds]))) return fail("لا تملك صلاحية عرض أداء الإعلانات", 403);
    return ok({ recommendations: await getMerchantAdRecommendations(store.id) });
  } catch (error) {
    return handleApiError(error, "تعذر تجهيز توصيات الإعلان");
  }
}
