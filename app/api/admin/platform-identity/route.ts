export const dynamic = "force-dynamic";

import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, systemSettings } from "@/lib/db";
import { assertAdminOperation } from "@/lib/rbac";
import { getPlatformIdentity, invalidatePlatformIdentityCache, platformIdentitySchema } from "@/lib/platform-identity";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

export async function GET() {
  try { const session = await requireAuth(); await assertAdminOperation(session, "system.settings.view"); return ok({ identity: await getPlatformIdentity() }); }
  catch (error) { return handleApiError(error, "تعذر تحميل هوية المنصة"); }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth(); await assertAdminOperation(session, "system.settings.edit");
    const identity = platformIdentitySchema.parse(await request.json());
    const [setting] = await db.insert(systemSettings).values({ group: "platform", key: "identity", value: identity, isPublic: true, updatedBy: session.userId }).onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value: identity, isPublic: true, updatedBy: session.userId, updatedAt: new Date() } }).returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "platform_identity", entityId: "identity", afterData: setting });
    invalidatePlatformIdentityCache();
    await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home, PUBLIC_CACHE_TAGS.settings], paths: ["/", "/offers", "/wings"] });
    return ok({ identity, message: "تم حفظ هوية المنصة وواجهة الهيدر والفوتر" });
  } catch (error) { return handleApiError(error, "تعذر حفظ هوية المنصة"); }
}
