export const dynamic = "force-dynamic";

import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ClipboardCheck } from "lucide-react";
import { TestControlPanel } from "@/components/admin/test-control-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { db, qaTestRuns, users } from "@/lib/db";
import { QA_TEST_CATALOG } from "@/lib/qa/test-catalog";
import { assertAdminOperation } from "@/lib/rbac";

export default async function TestControlPage() {
  const session = await requireAuth();
  await assertAdminOperation(session, "system.security_center.manage");
  const rows = await db
    .select({
      id: qaTestRuns.id,
      caseKey: qaTestRuns.caseKey,
      category: qaTestRuns.category,
      status: qaTestRuns.status,
      severity: qaTestRuns.severity,
      evidenceUrl: qaTestRuns.evidenceUrl,
      note: qaTestRuns.note,
      failureSummary: qaTestRuns.failureSummary,
      createdAt: qaTestRuns.createdAt,
      executorName: users.fullName
    })
    .from(qaTestRuns)
    .leftJoin(users, eq(qaTestRuns.executorUserId, users.id))
    .orderBy(desc(qaTestRuns.createdAt))
    .limit(300);
  const runs = rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));

  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700"><ClipboardCheck className="h-3.5 w-3.5" /> Staging QA</div><h1 className="mt-3 text-3xl font-black text-slate-950">مركز اختبارات الفريق والأدلة</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">يجمع حالات الاختبار والأدلة والأعطال من حسابات QA الفردية. لا يعني تسجيل النتيجة أن Production أصبح مسموحاً.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div>
        <TestControlPanel cases={QA_TEST_CATALOG} runs={runs} />
      </section>
    </main>
  );
}
