export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { adminPromotionalOffers, db } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { adminPromotionalOfferSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "offers.manage");
    const payload = adminPromotionalOfferSchema.partial().parse(await request.json());
    const [before] = await db.select().from(adminPromotionalOffers).where(eq(adminPromotionalOffers.id, id)).limit(1);
    if (!before) return fail("العرض غير موجود", 404);
    const [offer] = await db
      .update(adminPromotionalOffers)
      .set({
        title: payload.title ?? before.title,
        slug: payload.slug || (payload.title ? slugify(payload.title) : before.slug),
        category: payload.category ?? before.category,
        description: payload.description === undefined ? before.description : payload.description,
        imageUrl: payload.imageUrl === undefined ? before.imageUrl : payload.imageUrl || null,
        videoUrl: payload.videoUrl === undefined ? before.videoUrl : payload.videoUrl || null,
        contactName: payload.contactName === undefined ? before.contactName : payload.contactName,
        contactPhone: payload.contactPhone === undefined ? before.contactPhone : payload.contactPhone,
        whatsappUrl: payload.whatsappUrl === undefined ? before.whatsappUrl : payload.whatsappUrl || null,
        locationText: payload.locationText === undefined ? before.locationText : payload.locationText,
        externalUrl: payload.externalUrl === undefined ? before.externalUrl : payload.externalUrl || null,
        socialLinks: payload.socialLinks ?? before.socialLinks,
        status: payload.status ?? before.status,
        startsAt: payload.startsAt === undefined ? before.startsAt : payload.startsAt ? new Date(payload.startsAt) : null,
        endsAt: payload.endsAt === undefined ? before.endsAt : payload.endsAt ? new Date(payload.endsAt) : null,
        visibilitySchedule: payload.visibilitySchedule ?? before.visibilitySchedule,
        isFeatured: payload.isFeatured ?? before.isFeatured,
        sortOrder: payload.sortOrder ?? before.sortOrder,
        updatedAt: new Date()
      })
      .where(eq(adminPromotionalOffers.id, id))
      .returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "admin_promotional_offer", entityId: id, beforeData: before, afterData: offer });
    await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.offers], paths: ["/", "/offers", `/offers/admin-${before.slug}`, `/offers/admin-${offer.slug}`] });
    return ok({ offer, message: "تم تحديث العرض" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث عرض الإدارة");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "offers.manage");
    const [before] = await db.select().from(adminPromotionalOffers).where(eq(adminPromotionalOffers.id, id)).limit(1);
    if (!before) return fail("العرض غير موجود", 404);
    await db.delete(adminPromotionalOffers).where(eq(adminPromotionalOffers.id, id));
    await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "admin_promotional_offer", entityId: id, beforeData: before });
    await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.offers], paths: ["/", "/offers", `/offers/admin-${before.slug}`] });
    return ok({ message: "تم حذف العرض" });
  } catch (error) {
    return handleApiError(error, "تعذر حذف عرض الإدارة");
  }
}
