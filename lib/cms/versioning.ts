import { desc, eq, sql } from "drizzle-orm";
import { cmsPages, cmsPageVersions, db } from "@/lib/db";

type CmsPage = typeof cmsPages.$inferSelect;
type NewCmsPage = typeof cmsPages.$inferInsert;

type DbLike = any;

export function cmsSnapshot(page: CmsPage | NewCmsPage | Record<string, unknown>) {
  const value = page as Record<string, unknown>;
  return {
    title: value.title,
    slug: value.slug,
    type: value.type,
    excerpt: value.excerpt,
    content: value.content,
    status: value.status,
    seo: value.seo || {},
    isSystem: value.isSystem,
    sortOrder: value.sortOrder
  } as Record<string, unknown>;
}

export async function createCmsPageVersion(input: { pageId: string; snapshot: CmsPage | NewCmsPage | Record<string, unknown>; actorId?: string | null; changeNote?: string | null; tx?: DbLike }) {
  const tx = input.tx || db;
  const [{ maxVersion }] = await tx.select({ maxVersion: sql<number>`coalesce(max(${cmsPageVersions.version}), 0)::int` }).from(cmsPageVersions).where(eq(cmsPageVersions.cmsPageId, input.pageId));
  const [version] = await tx.insert(cmsPageVersions).values({ cmsPageId: input.pageId, version: Number(maxVersion || 0) + 1, snapshot: cmsSnapshot(input.snapshot), createdBy: input.actorId || null, changeNote: input.changeNote || null }).returning();
  return version;
}

export async function getCmsPageVersions(pageId: string) {
  return db.select().from(cmsPageVersions).where(eq(cmsPageVersions.cmsPageId, pageId)).orderBy(desc(cmsPageVersions.version)).limit(100);
}
