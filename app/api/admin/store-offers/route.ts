export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, offerCampaigns, storeOfferCollections, stores } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "offers.manage");
    const offers = await db
      .select({ offer: storeOfferCollections, store: stores, campaign: offerCampaigns })
      .from(storeOfferCollections)
      .innerJoin(stores, eq(storeOfferCollections.storeId, stores.id))
      .leftJoin(offerCampaigns, eq(storeOfferCollections.campaignId, offerCampaigns.id))
      .orderBy(desc(storeOfferCollections.createdAt))
      .limit(200);
    return ok({ offers });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل عروض المتاجر");
  }
}
