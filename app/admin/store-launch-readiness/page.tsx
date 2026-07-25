export const dynamic="force-dynamic";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { Rocket } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { db, storeLaunchReadiness, stores } from "@/lib/db";
import { StoreLaunchReadinessReviewPanel } from "@/components/admin/store-launch-readiness-review-panel";
export default async function AdminStoreLaunchReadinessPage(){const session=await requireAuth();await assertAdmin(session,["merchant_applications.launch.review","merchant_applications.manage"]);const rows=await db.select({readiness:storeLaunchReadiness,storeName:stores.name,storeNumber:stores.storeNumber,checks:storeLaunchReadiness.checks}).from(storeLaunchReadiness).innerJoin(stores,eq(storeLaunchReadiness.storeId,stores.id)).where(eq(storeLaunchReadiness.status,"submitted")).orderBy(desc(storeLaunchReadiness.submittedAt)).limit(300);return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700"><Rocket className="h-4 w-4"/> Launch Review</div><h1 className="text-3xl font-black text-slate-950">مراجعة إطلاق المتاجر</h1><p className="mt-2 text-sm leading-7 text-slate-500">الحسابات المعتمدة لا تظهر للعامة قبل اجتياز checklist الإطلاق واعتماد الإدارة.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div><StoreLaunchReadinessReviewPanel rows={JSON.parse(JSON.stringify(rows))}/></section></main>}
