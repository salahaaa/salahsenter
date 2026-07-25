export const dynamic = "force-dynamic";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, systemSettings } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { getAdvertisingSettings } from "@/lib/advertising-settings";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

function revalidatePublicPages() {
  revalidatePath("/");
  revalidatePath("/wings");
}

const schema = z.object({
  maxActiveStoreAnnouncements: z.coerce.number().int().min(0).max(100).default(3),
  maxActiveStoreNews: z.coerce.number().int().min(0).max(100).default(10),
  marketplaceAnnouncementsLimit: z.coerce.number().int().min(1).max(100).default(8),
  storeAnnouncementsLimit: z.coerce.number().int().min(1).max(100).default(8),
  storeNewsLimit: z.coerce.number().int().min(1).max(100).default(10),
  enablePromotedOffers: z.boolean().default(true)
});

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "ads.view");
    revalidatePublicPages();
    return ok({ settings: await getAdvertisingSettings() });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل إعدادات الإعلانات");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdminOperation(session, "ads.settings");
    const payload = schema.parse(await request.json());
    const [setting] = await db
      .insert(systemSettings)
      .values({ group: "advertising", key: "limits", value: payload, isPublic: false, updatedBy: session.userId })
      .onConflictDoUpdate({
        target: [systemSettings.group, systemSettings.key],
        set: { value: payload, isPublic: false, updatedBy: session.userId, updatedAt: new Date() }
      })
      .returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "advertising_settings", entityId: "limits", afterData: setting });
    revalidatePublicPages();
    return ok({ settings: payload, message: "تم حفظ إعدادات الإعلانات بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ إعدادات الإعلانات");
  }
}
