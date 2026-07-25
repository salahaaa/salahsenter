export const dynamic = "force-dynamic";

import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { ErpConflictCasePanel } from "@/components/admin/erp-conflict-case-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { db, erpConflictCases } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";

export default async function ErpConflictsPage() {
  const session = await requireAuth(); await assertAdminOperation(session, "system.erp.manage");
  const cases = await db.select().from(erpConflictCases).where(inArray(erpConflictCases.status, ["open", "assigned"])).orderBy(desc(erpConflictCases.createdAt)).limit(200);
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap justify-between gap-3"><div><h1 className="text-3xl font-black">حالات تعارض ERP</h1><p className="mt-2 text-sm text-slate-500">قرارات لكل كيان مع لقطات بيانات وأثر تدقيقي؛ لا يتم الكتابة على مصدر بدون قرار موثق.</p></div><Button asChild variant="outline"><Link href="/admin/integrations">العودة للتكاملات</Link></Button></div><ErpConflictCasePanel initial={JSON.parse(JSON.stringify(cases))}/></section></main>;
}
