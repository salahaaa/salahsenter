export const dynamic = "force-dynamic";

import { revalidatePath } from "next/cache";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { getHomeVisibilityRules, getHomepageFeaturedStores, getHomepagePromotedProducts, getHomepageSeasonalOffers, getHomepageWings } from "@/lib/home-visibility";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { writeAuditLog } from "@/lib/audit";

export async function POST() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "home.manage");
    const rules = await getHomeVisibilityRules();
    const now = new Date();
    const [stores, products, offers, wings] = await Promise.all([
      getHomepageFeaturedStores(rules, now),
      getHomepagePromotedProducts(rules, now),
      getHomepageSeasonalOffers(rules, now),
      getHomepageWings(rules)
    ]);
    await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.stores, PUBLIC_CACHE_TAGS.products, PUBLIC_CACHE_TAGS.offers, PUBLIC_CACHE_TAGS.wings], paths: ["/", "/wings", "/offers"] });
    revalidatePath("/");
    revalidatePath("/wings");
    revalidatePath("/offers");
    const result = { counts: { stores: stores.length, products: products.length, offers: offers.length, wings: wings.length }, generatedAt: now.toISOString() };
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "homepage_visibility_recalculate", entityId: "homepage", afterData: result });
    return ok({ ...result, message: "تمت إعادة حساب ترتيب الصفحة الرئيسية وتحديث الكاش" });
  } catch (error) {
    return handleApiError(error, "تعذر إعادة حساب ترتيب الصفحة الرئيسية");
  }
}
