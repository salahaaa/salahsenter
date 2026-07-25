import Link from "next/link";
import { desc } from "drizzle-orm";
import { CmsPageForm } from "@/components/admin/enterprise/cms-page-form";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cmsPages, db } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
export default async function CmsAdminPage(){
  const session = await requireAuth();
  await assertAdmin(session, "cms.manage");const pages=hasDatabase()?await db.select().from(cmsPages).orderBy(desc(cmsPages.createdAt)).limit(100):[];return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-black text-slate-950">CMS إدارة المحتوى</h1><p className="mt-2 text-sm text-slate-500">الصفحات، المقالات، الأخبار، الأسئلة الشائعة، الشروط والخصوصية بدون تعديل الكود.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div><CmsPageForm/><div className="mt-8">{!pages.length?<EmptyState title="لا توجد صفحات"/>:<div className="grid gap-4 md:grid-cols-3">{pages.map(p=><article key={p.id} className="rounded-3xl border bg-white p-5 shadow-card"><div className="flex items-center justify-between"><h3 className="font-black">{p.title}</h3><Badge variant={p.status==="active"?"success":"outline"}>{p.status}</Badge></div><p className="mt-2 text-xs text-slate-500">/{p.slug} — {p.type}</p><p className="mt-3 line-clamp-2 text-sm text-slate-600">{p.excerpt||p.content}</p><div className="mt-4 flex flex-wrap gap-2"><Button asChild size="sm"><Link href={`/admin/cms/${p.id}`}>تحرير وإصدارات</Link></Button><Button asChild size="sm" variant="outline"><Link href={`/admin/cms/preview/${p.id}`}>معاينة</Link></Button>{p.status === "active" ? <Button asChild size="sm" variant="outline"><Link href={`/${p.slug}`} target="_blank">الصفحة العامة</Link></Button> : null}</div></article>)}</div>}</div></section></main>}
