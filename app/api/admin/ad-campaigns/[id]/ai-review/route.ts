export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { adCampaigns, db, stores } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { reviewMerchantAd } from "@/lib/ai/admin-review-assistant";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdminOperation(session, "ads.edit");
    const [row] = await db.select({ campaign: adCampaigns, storeName: stores.name }).from(adCampaigns).innerJoin(stores, eq(adCampaigns.storeId, stores.id)).where(eq(adCampaigns.id, id)).limit(1);
    if (!row) return fail("الإعلان غير موجود", 404);
    const campaign = row.campaign;
    return ok({ review: reviewMerchantAd({ name: campaign.name, type: campaign.type, status: campaign.status, storeName: row.storeName, budget: campaign.budget, dailyBudget: campaign.dailyBudget, startsAt: campaign.startsAt, endsAt: campaign.endsAt, creative: campaign.creative as Record<string, unknown> }) });
  } catch (error) {
    return handleApiError(error, "تعذر تحليل الإعلان");
  }
}
