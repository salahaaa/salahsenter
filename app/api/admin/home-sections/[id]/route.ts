export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, homeSections } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";
import { isCustomHomeSectionType, normalizeCustomHomeSectionConfig } from "@/lib/home-section-templates";
import { revalidatePath } from "next/cache";

const schema = z.object({ title: z.string().trim().min(2).max(160).optional(), isVisible: z.boolean().optional(), config: z.record(z.unknown()).optional() });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; const session = await requireAuth(); await assertAdmin(session, "home.manage"); const payload = schema.parse(await request.json());
    const [before] = await db.select().from(homeSections).where(eq(homeSections.id, id)).limit(1); if (!before) return fail("القسم غير موجود", 404);
    const config = payload.config === undefined ? before.config : isCustomHomeSectionType(before.type) ? normalizeCustomHomeSectionConfig(payload.config) : payload.config;
    const [section] = await db.update(homeSections).set({ title: payload.title ?? before.title, isVisible: payload.isVisible ?? before.isVisible, config, updatedAt: new Date() }).where(eq(homeSections.id, before.id)).returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "home_section", entityId: section.id, beforeData: before, afterData: section });
    revalidatePath("/"); await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home], paths: ["/"] });
    return ok({ section, message: "تم حفظ إعدادات القسم" });
  } catch (error) { return handleApiError(error, "تعذر تحديث القسم"); }
}
