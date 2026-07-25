export const dynamic = "force-dynamic";

import Link from "next/link";
import { desc } from "drizzle-orm";
import { ReleaseGatePanel } from "@/components/admin/release-gate-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { db, operationalDrills, releaseGateRuns } from "@/lib/db";
import { getProductionReadiness } from "@/lib/production/readiness";
import { assertAdminOperation } from "@/lib/rbac";

export default async function ReleaseGatesPage() {
  const session = await requireAuth(); await assertAdminOperation(session, "system.security_center.manage");
  const [readiness, drills, gates] = await Promise.all([getProductionReadiness(), db.select().from(operationalDrills).orderBy(desc(operationalDrills.createdAt)).limit(100), db.select().from(releaseGateRuns).orderBy(desc(releaseGateRuns.createdAt)).limit(50)]);
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-black">جاهزية الإطلاق والأدلة التشغيلية</h1><p className="mt-2 text-sm text-slate-500">تجميع آلي للمتطلبات وسجل أدلة اختبارات Staging؛ لا يستبدل موافقة التشغيل والنشر.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div><ReleaseGatePanel readiness={readiness} drills={drills} gates={gates}/></section></main>;
}
