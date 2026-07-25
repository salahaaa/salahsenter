export const dynamic = "force-dynamic";

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, homeSections } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";
import { isCustomHomeSectionType, normalizeCustomHomeSectionConfig, normalizeHomeSectionCode } from "@/lib/home-section-templates";
import { defaultHomeSections } from "@/lib/home-layout";
import { setHomeLayoutManaged } from "@/lib/home-layout-management";

function revalidatePublicPages() { revalidatePath("/"); revalidatePath("/wings"); }
const schema = z.object({ code: z.string().min(2).max(100), title: z.string().trim().min(2).max(160), type: z.string().trim().min(2).max(80), isVisible: z.boolean().default(true), sortOrder: z.coerce.number().int().min(0).max(10_000).default(0), config: z.record(z.unknown()).default({}) });

function normalizePayload(payload: z.infer<typeof schema>) {
  const code = normalizeHomeSectionCode(payload.code);
  const type = payload.type.trim();
  return { ...payload, code, type, config: isCustomHomeSectionType(type) ? normalizeCustomHomeSectionConfig(payload.config) : payload.config };
}

export async function GET() {
  try { const session = await requireAuth(); await assertAdmin(session, "home.manage"); return ok({ sections: await db.select().from(homeSections).orderBy(asc(homeSections.sortOrder)) }); }
  catch (error) { return handleApiError(error, "تعذر تحميل أقسام الصفحة الرئيسية"); }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(); await assertAdmin(session, "home.manage");
    const payload = normalizePayload(schema.parse(await request.json()));
    const result = await db.transaction(async (tx) => {
      // The first managed change persists the full default layout, so an admin
      // never accidentally hides all fallback sections by adding one custom card.
      for (const section of defaultHomeSections) await tx.insert(homeSections).values(section).onConflictDoNothing({ target: homeSections.code });
      const [existing] = await tx.select().from(homeSections).where(eq(homeSections.code, payload.code)).limit(1);
      const [section] = existing
        ? await tx.update(homeSections).set({ title: payload.title, type: payload.type, isVisible: payload.isVisible, sortOrder: payload.sortOrder || existing.sortOrder, config: payload.config, updatedAt: new Date() }).where(eq(homeSections.id, existing.id)).returning()
        : await tx.insert(homeSections).values(payload).returning();
      await setHomeLayoutManaged(tx, session.userId);
      return { section, existing };
    });
    const { section, existing } = result;
    await writeAuditLog({ actorId: session.userId, action: existing ? "update" : "create", entityType: "home_section", entityId: section.id, beforeData: existing || null, afterData: section });
    revalidatePublicPages(); await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home], paths: ["/"] });
    return existing ? ok({ section, message: "تم تحديث القسم الموجود بالقالب المختار" }) : created({ section, message: "تم إنشاء قسم الصفحة الرئيسية" });
  } catch (error) { return handleApiError(error, "تعذر إنشاء أو تحديث القسم"); }
}
