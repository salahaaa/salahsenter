export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { asc } from "drizzle-orm";
import { ActivityTemplateCatalogPanel } from "@/components/admin/activity-template-catalog-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { db, merchantActivityTemplateCatalog } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

export default async function AdminActivityTemplatesPage() { const session = await requireAuth(); await assertAdmin(session, ["activity_templates.manage", "products.manage", "master.manage"]); const templates = await db.select().from(merchantActivityTemplateCatalog).orderBy(asc(merchantActivityTemplateCatalog.sector), asc(merchantActivityTemplateCatalog.name)); return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 inline-flex rounded-full bg-violet-100 px-4 py-2 text-xs font-black text-violet-800">Merchant Sector Catalog</div><h1 className="text-3xl font-black text-slate-950 md:text-5xl">كتالوج قطاعات التجار</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">أنشئ قطاعاً كاملاً يراه التاجر في قائمة القوالب: تصنيفات ووحدات وخصائص وقيم ومنتجات Draft اختيارية، بلا برمجة.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div><ActivityTemplateCatalogPanel initial={JSON.parse(JSON.stringify(templates))}/></section></main>; }
