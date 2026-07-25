export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequeueDeadLetterButton } from "@/components/admin/requeue-dead-letter-button";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { backgroundJobs, db } from "@/lib/db";

export default async function QueueDashboardPage() {
  const session = await requireAuth();
  await assertAdmin(session, "reports.view");
  const [byStatus, failed, deadLetters, recent] = await Promise.all([
    db.select({ status: backgroundJobs.status, count: sql<number>`count(*)::int` }).from(backgroundJobs).groupBy(backgroundJobs.status),
    db.select().from(backgroundJobs).where(eq(backgroundJobs.status, "failed")).orderBy(desc(backgroundJobs.updatedAt)).limit(30),
    db.select().from(backgroundJobs).where(eq(backgroundJobs.status, "dead_letter")).orderBy(desc(backgroundJobs.deadLetteredAt)).limit(30),
    db.select().from(backgroundJobs).orderBy(desc(backgroundJobs.createdAt)).limit(80)
  ]);
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-black">Queue Dashboard</h1><p className="mt-2 text-sm text-slate-500">مراقبة background jobs والـ retries وDead Letter Queue.</p></div><Button asChild variant="outline"><Link href="/admin/observability">العودة</Link></Button></div><section className="grid gap-4 md:grid-cols-4">{byStatus.map((row)=><div key={row.status} className="rounded-3xl border bg-white p-5 shadow-card"><p className="text-sm font-bold text-slate-500">{row.status}</p><p className="mt-2 text-3xl font-black">{row.count}</p></div>)}</section>{deadLetters.length ? <section className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-6"><h2 className="mb-4 text-xl font-black text-rose-950">Dead Letter Queue</h2><div className="space-y-3">{deadLetters.map((job)=><div key={job.id} className="flex flex-col justify-between gap-3 rounded-2xl border bg-white p-4 md:flex-row md:items-center"><div><p className="font-black">{job.type}</p><p className="mt-1 text-xs text-rose-700">{job.deadLetterReason || job.lastError || "سبب غير مسجل"}</p><p className="mt-1 text-xs text-slate-500">محاولات: {job.attempts}/{job.maxAttempts}</p></div><RequeueDeadLetterButton jobId={job.id}/></div>)}</div></section> : null}<section className="mt-8 rounded-3xl border bg-white p-6 shadow-card"><h2 className="mb-4 text-xl font-black">آخر الوظائف والفشل العادي ({failed.length})</h2><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-right text-sm"><thead className="bg-slate-100"><tr><th className="p-3">النوع</th><th className="p-3">الحالة</th><th className="p-3">المحاولات</th><th className="p-3">الخطأ</th><th className="p-3">التاريخ</th></tr></thead><tbody>{recent.map((job)=><tr key={job.id} className="border-t"><td className="p-3 font-bold">{job.type}</td><td className="p-3"><Badge variant={job.status==='completed'?'success':job.status==='failed'||job.status==='dead_letter'?'danger':'warning'}>{job.status}</Badge></td><td className="p-3">{job.attempts}/{job.maxAttempts}</td><td className="p-3 text-xs text-red-600">{job.lastError || '-'}</td><td className="p-3 text-xs text-slate-500">{new Intl.DateTimeFormat('ar',{dateStyle:'short',timeStyle:'short'}).format(job.createdAt)}</td></tr>)}</tbody></table></div></section></section></main>;
}
