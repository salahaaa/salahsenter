export const dynamic = "force-dynamic";

import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { cmsPages, db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

export default async function CmsPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth();
  await assertAdmin(session, "cms.manage");
  const [page] = await db.select().from(cmsPages).where(eq(cmsPages.id, id)).limit(1);
  if (!page) notFound();
  return <main className="min-h-screen bg-slate-50"><SiteHeader/><section className="container max-w-4xl py-8"><div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-900"><span className="inline-flex items-center gap-2"><Eye className="h-4 w-4"/> معاينة داخلية — لا تؤثر في الصفحة العامة حتى النشر.</span><Button asChild size="sm" variant="outline"><Link href="/admin/cms">العودة إلى CMS</Link></Button></div><article className="overflow-hidden rounded-[2rem] border bg-white shadow-card"><header className="bg-slate-950 p-8 text-white"><p className="text-xs font-black text-blue-300">{page.type} · {page.status}</p><h1 className="mt-3 text-4xl font-black">{page.title}</h1>{page.excerpt ? <p className="mt-4 leading-8 text-white/75">{page.excerpt}</p> : null}</header><section className="whitespace-pre-wrap p-8 text-right text-sm leading-9 text-slate-700">{page.content}</section></article></section></main>;
}
