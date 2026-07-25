export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { cmsPages, cmsPageVersions, db } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { createCmsPageVersion } from "@/lib/cms/versioning";

export async function POST(_request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const { id, versionId } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "cms.manage");
    const [before, version] = await Promise.all([
      db.select().from(cmsPages).where(eq(cmsPages.id, id)).limit(1).then((rows) => rows[0] || null),
      db.select().from(cmsPageVersions).where(and(eq(cmsPageVersions.id, versionId), eq(cmsPageVersions.cmsPageId, id))).limit(1).then((rows) => rows[0] || null)
    ]);
    if (!before || !version) return fail("الصفحة أو النسخة غير موجودة", 404);
    const snapshot = version.snapshot as Record<string, unknown>;
    const result = await db.transaction(async (tx) => {
      await createCmsPageVersion({ pageId: id, snapshot: before, actorId: session.userId, changeNote: `نسخة تلقائية قبل استعادة الإصدار ${version.version}`, tx });
      const [page] = await tx.update(cmsPages).set({
        title: String(snapshot.title || before.title),
        slug: String(snapshot.slug || before.slug),
        type: String(snapshot.type || before.type),
        excerpt: typeof snapshot.excerpt === "string" ? snapshot.excerpt : null,
        content: String(snapshot.content || ""),
        status: (snapshot.status as any) || before.status,
        seo: (snapshot.seo as Record<string, unknown>) || {},
        isSystem: typeof snapshot.isSystem === "boolean" ? snapshot.isSystem : before.isSystem,
        sortOrder: Number.isFinite(Number(snapshot.sortOrder)) ? Number(snapshot.sortOrder) : before.sortOrder,
        updatedAt: new Date()
      }).where(eq(cmsPages.id, id)).returning();
      return page;
    });
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "cms_page_restored", entityId: id, beforeData: before, afterData: { page: result, restoredVersion: version.version } });
    return ok({ page: result, message: `تمت استعادة إصدار CMS رقم ${version.version}` });
  } catch (error) {
    return handleApiError(error, "تعذر استعادة إصدار CMS");
  }
}
