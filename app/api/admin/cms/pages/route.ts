export const dynamic = "force-dynamic";

import { desc } from "drizzle-orm";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { cmsPages, db } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { writeAuditLog } from "@/lib/audit";
import { createCmsPageVersion } from "@/lib/cms/versioning";

const schema = z.object({ title: z.string().min(2), slug: z.string().optional(), type: z.string().default("page"), excerpt: z.string().optional(), content: z.string().default(""), status: z.enum(["draft", "scheduled", "active", "expired", "disabled"]).default("draft"), seo: z.record(z.unknown()).default({}), isSystem: z.boolean().default(false), sortOrder: z.coerce.number().int().default(0), changeNote: z.string().max(1_000).optional() });

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "cms.manage");
    const pages = await db.select().from(cmsPages).orderBy(desc(cmsPages.createdAt)).limit(200);
    return ok({ pages });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل صفحات CMS");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "cms.manage");
    const payload = schema.parse(await request.json());
    const { changeNote, ...pageValues } = payload;
    const result = await db.transaction(async (tx) => {
      const [page] = await tx.insert(cmsPages).values({ ...pageValues, slug: pageValues.slug || slugify(pageValues.title), createdBy: session.userId }).returning();
      const version = await createCmsPageVersion({ pageId: page.id, snapshot: page, actorId: session.userId, changeNote: changeNote || "إنشاء الصفحة", tx });
      return { page, version };
    });
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "cms_page", entityId: result.page.id, afterData: result });
    return created({ ...result, message: "تم حفظ الصفحة وإنشاء النسخة الأولى" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ الصفحة");
  }
}
