export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, homeSections } from "@/lib/db";
import { setHomeLayoutManaged } from "@/lib/home-layout-management";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { invalidatePublicCache } from "@/lib/cache/public-cache";
import { PUBLIC_CACHE_TAGS } from "@/lib/cache/cache-tags";

function revalidatePublicPages() {
  revalidatePath("/");
  revalidatePath("/wings");
}

const schema = z.object({
  sections: z.array(z.object({ id: z.string().uuid().optional(), code: z.string().min(2).max(100), type: z.string().min(2).max(80), config: z.record(z.unknown()).default({}), sortOrder: z.number().int(), isVisible: z.boolean().optional(), title: z.string().min(2).max(160).optional() })).min(1).max(100)
});

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "home.manage");
    const payload = schema.parse(await request.json());
    await db.transaction(async (tx) => {
      for (const section of payload.sections) {
        const [existing] = section.id ? await tx.select().from(homeSections).where(eq(homeSections.id, section.id)).limit(1) : await tx.select().from(homeSections).where(eq(homeSections.code, section.code)).limit(1);
        const values = { code: section.code, type: section.type, config: section.config, sortOrder: section.sortOrder, isVisible: section.isVisible ?? true, title: section.title || existing?.title || section.code };
        if (existing) await tx.update(homeSections).set({ ...values, updatedAt: new Date() }).where(eq(homeSections.id, existing.id));
        else await tx.insert(homeSections).values(values);
      }
      await setHomeLayoutManaged(tx, session.userId);
    });
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "home_sections_reorder", afterData: payload });
    revalidatePublicPages();
    await invalidatePublicCache({ tags: [PUBLIC_CACHE_TAGS.home], paths: ["/"] });
    return ok({ message: "تم تحديث ترتيب الصفحة الرئيسية بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث ترتيب الصفحة الرئيسية");
  }
}
