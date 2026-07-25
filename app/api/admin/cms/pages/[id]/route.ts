export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { cmsPages, cmsPageVersions, db } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { writeAuditLog } from "@/lib/audit";
import { createCmsPageVersion } from "@/lib/cms/versioning";

const schema = z.object({ title: z.string().min(2).optional(), slug: z.string().optional(), type: z.string().optional(), excerpt: z.string().optional(), content: z.string().optional(), status: z.enum(["draft", "scheduled", "active", "expired", "disabled"]).optional(), seo: z.record(z.unknown()).optional(), isSystem: z.boolean().optional(), sortOrder: z.coerce.number().int().optional(), changeNote: z.string().max(1_000).optional() });

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "cms.manage");
    const [page, versions] = await Promise.all([
      db.select().from(cmsPages).where(eq(cmsPages.id, id)).limit(1).then((rows) => rows[0] || null),
      db.select().from(cmsPageVersions).where(eq(cmsPageVersions.cmsPageId, id)).orderBy(desc(cmsPageVersions.version)).limit(100)
    ]);
    if (!page) return fail("الصفحة غير موجودة", 404);
    return ok({ page, versions });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل صفحة CMS وإصداراتها");
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "cms.manage");
    const payload = schema.parse(await request.json());
    const [before] = await db.select().from(cmsPages).where(eq(cmsPages.id, id)).limit(1);
    if (!before) return fail("الصفحة غير موجودة", 404);
    const { changeNote, ...updates } = payload;
    const result = await db.transaction(async (tx) => {
      await createCmsPageVersion({ pageId: before.id, snapshot: before, actorId: session.userId, changeNote: changeNote || "نسخة قبل التعديل", tx });
      const [page] = await tx.update(cmsPages).set({ ...updates, slug: updates.slug || (updates.title ? slugify(updates.title) : undefined), updatedAt: new Date() }).where(eq(cmsPages.id, id)).returning();
      return { page };
    });
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "cms_page", entityId: id, beforeData: before, afterData: result.page });
    return ok({ ...result, message: "تم تعديل الصفحة وحفظ نسخة قابلة للاستعادة" });
  } catch (error) {
    return handleApiError(error, "تعذر تعديل الصفحة");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "cms.manage");
    const [before] = await db.select().from(cmsPages).where(eq(cmsPages.id, id)).limit(1);
    if (!before) return fail("الصفحة غير موجودة", 404);
    const [page] = await db.update(cmsPages).set({ status: "disabled", updatedAt: new Date() }).where(eq(cmsPages.id, id)).returning();
    await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "cms_page", entityId: id, beforeData: before, afterData: page });
    return ok({ message: "تم تعطيل الصفحة بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حذف الصفحة");
  }
}
