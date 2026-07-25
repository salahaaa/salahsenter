export const dynamic = "force-dynamic";

import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CmsPageEditor } from "@/components/admin/cms-page-editor";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { cmsPages, cmsPageVersions, db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

export default async function CmsPageEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const session = await requireAuth(); await assertAdmin(session, "cms.manage");
  const [page, versions] = await Promise.all([db.select().from(cmsPages).where(eq(cmsPages.id, id)).limit(1).then((rows) => rows[0] || null), db.select().from(cmsPageVersions).where(eq(cmsPageVersions.cmsPageId, id)).orderBy(desc(cmsPageVersions.version)).limit(100)]);
  if (!page) notFound();
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap justify-between gap-3"><div><h1 className="text-3xl font-black">تحرير: {page.title}</h1><p className="mt-2 text-sm text-slate-500">معاينة، تعديل، سجل إصدارات واستعادة آمنة.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href={`/admin/cms/preview/${page.id}`}>معاينة</Link></Button><Button asChild variant="outline"><Link href="/admin/cms">العودة للـ CMS</Link></Button></div></div><CmsPageEditor page={JSON.parse(JSON.stringify(page))} versions={JSON.parse(JSON.stringify(versions))}/></section></main>;
}
