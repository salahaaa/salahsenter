export const dynamic = "force-dynamic";

import { asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, offerCampaigns } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { offerCampaignSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "offers.manage");
    const campaigns = await db.select().from(offerCampaigns).orderBy(asc(offerCampaigns.sortOrder), desc(offerCampaigns.createdAt));
    return ok({ campaigns });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل مواسم العروض");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "offers.manage");
    const payload = offerCampaignSchema.parse(await request.json());
    const [campaign] = await db.insert(offerCampaigns).values({ ...payload, slug: payload.slug || slugify(payload.name), imageUrl: payload.imageUrl || null, startAt: payload.startAt ? new Date(payload.startAt) : null, endAt: payload.endAt ? new Date(payload.endAt) : null, createdBy: session.userId }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "offer_campaign", entityId: campaign.id, afterData: campaign });
    revalidatePath("/");
    return created({ campaign, message: "تم إنشاء موسم العروض" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء موسم العروض");
  }
}
