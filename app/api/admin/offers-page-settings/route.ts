export const dynamic = "force-dynamic";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, systemSettings } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { defaultOffersPageSettings, normalizeOffersPageSettings } from "@/lib/offers-page-settings";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

const schema = z.object({
  heroBadge: z.string().optional(),
  heroTitle: z.string().optional(),
  heroDescription: z.string().optional(),
  heroPrimaryLabel: z.string().optional(),
  heroPrimaryUrl: z.string().optional(),
  heroSecondaryLabel: z.string().optional(),
  heroSecondaryUrl: z.string().optional(),
  heroBackgroundColor: z.string().optional(),
  heroTextColor: z.string().optional(),
  heroBackgroundImage: z.string().optional(),
  showHeroButtons: z.boolean().optional(),
  listTitle: z.string().optional(),
  listSubtitle: z.string().optional(),
  listDescription: z.string().optional(),
  listBackgroundColor: z.string().optional(),
  listTextColor: z.string().optional(),
  listBackgroundImage: z.string().optional(),
  adminSectionTitle: z.string().optional(),
  adminSectionSubtitle: z.string().optional(),
  recommendationTitle: z.string().optional(),
  recommendationDescription: z.string().optional()
});

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "offers.manage");
    const [setting] = await db.select().from(systemSettings).where(sqlWhere()).limit(1);
    return ok({ settings: normalizeOffersPageSettings(setting?.value || defaultOffersPageSettings) });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل إعدادات صفحة العروض");
  }
}

function sqlWhere() {
  return and(eq(systemSettings.group, "offers"), eq(systemSettings.key, "page_settings"));
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "offers.manage");
    const payload = schema.parse(await request.json());
    const [before] = await db.select().from(systemSettings).where(sqlWhere()).limit(1);
    const value = normalizeOffersPageSettings({ ...(before?.value as Record<string, unknown> | undefined), ...payload });
    const [setting] = await db
      .insert(systemSettings)
      .values({ group: "offers", key: "page_settings", value, isPublic: true, updatedBy: session.userId })
      .onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value, isPublic: true, updatedBy: session.userId, updatedAt: new Date() } })
      .returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "offers_page_settings", entityId: setting.id, beforeData: before || null, afterData: setting });
    revalidatePath("/offers");
    await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.offers, PUBLIC_CACHE_TAGS.home], paths: ["/offers", "/"] });
    return ok({ settings: value, message: "تم حفظ إعدادات صفحة العروض" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ إعدادات صفحة العروض");
  }
}
