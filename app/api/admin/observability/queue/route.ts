export const dynamic = "force-dynamic";

import { desc, eq, sql } from "drizzle-orm";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { backgroundJobs, db } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "reports.view");

    const [byStatus, recentFailures, deadLetters, recentJobs] = await Promise.all([
      db
        .select({ status: backgroundJobs.status, count: sql<number>`count(*)::int` })
        .from(backgroundJobs)
        .groupBy(backgroundJobs.status),
      db
        .select({ id: backgroundJobs.id, type: backgroundJobs.type, queue: backgroundJobs.queue, attempts: backgroundJobs.attempts, lastError: backgroundJobs.lastError, failedAt: backgroundJobs.failedAt, updatedAt: backgroundJobs.updatedAt })
        .from(backgroundJobs)
        .where(eq(backgroundJobs.status, "failed"))
        .orderBy(desc(backgroundJobs.updatedAt))
        .limit(20),
      db
        .select({ id: backgroundJobs.id, type: backgroundJobs.type, queue: backgroundJobs.queue, attempts: backgroundJobs.attempts, deadLetterReason: backgroundJobs.deadLetterReason, deadLetteredAt: backgroundJobs.deadLetteredAt, updatedAt: backgroundJobs.updatedAt })
        .from(backgroundJobs)
        .where(eq(backgroundJobs.status, "dead_letter"))
        .orderBy(desc(backgroundJobs.deadLetteredAt))
        .limit(20),
      db
        .select({ id: backgroundJobs.id, type: backgroundJobs.type, queue: backgroundJobs.queue, status: backgroundJobs.status, attempts: backgroundJobs.attempts, availableAt: backgroundJobs.availableAt, createdAt: backgroundJobs.createdAt, updatedAt: backgroundJobs.updatedAt })
        .from(backgroundJobs)
        .orderBy(desc(backgroundJobs.createdAt))
        .limit(50)
    ]);

    return ok({ byStatus, recentFailures, deadLetters, recentJobs });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل مؤشرات الطابور");
  }
}
