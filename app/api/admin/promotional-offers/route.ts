export const dynamic = "force-dynamic";

import { desc } from "drizzle-orm";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { adminPromotionalOffers, db } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { slugify, uniqueSlug } from "@/lib/slug";
import { adminPromotionalOfferSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "offers.manage");
    const offers = await db.select().from(adminPromotionalOffers).orderBy(desc(adminPromotionalOffers.createdAt)).limit(200);
    return ok({ offers });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل عروض الإدارة الترويجية");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "offers.manage");
    const payload = adminPromotionalOfferSchema.parse(await request.json());
    const [offer] = await db
      .insert(adminPromotionalOffers)
      .values({
        title: payload.title,
        slug: payload.slug || uniqueSlug(slugify(payload.title) || payload.title),
        category: payload.category,
        description: payload.description,
        imageUrl: payload.imageUrl || null,
        videoUrl: payload.videoUrl || null,
        contactName: payload.contactName,
        contactPhone: payload.contactPhone,
        whatsappUrl: payload.whatsappUrl || null,
        locationText: payload.locationText,
        externalUrl: payload.externalUrl || null,
        socialLinks: payload.socialLinks,
        status: payload.status,
        startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
        endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
        visibilitySchedule: payload.visibilitySchedule,
        isFeatured: payload.isFeatured,
        sortOrder: payload.sortOrder,
        createdBy: session.userId
      })
      .returning();
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "admin_promotional_offer", entityId: offer.id, afterData: offer });
    await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.offers], paths: ["/", "/offers", `/offers/admin-${offer.slug}`] });
    return created({ offer, message: "تم إنشاء عرض الإدارة الترويجي" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء عرض الإدارة الترويجي");
  }
}
