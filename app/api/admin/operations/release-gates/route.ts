export const dynamic = "force-dynamic";

import { desc } from "drizzle-orm";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, operationalDrills, releaseGateRuns } from "@/lib/db";
import { getProductionReadiness } from "@/lib/production/readiness";
import { assertAdminOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const drillSchema = z.object({ kind: z.enum(["staging_e2e", "backup_recovery", "load_probe", "security_gate", "erp_pilot"]), environment: z.enum(["staging", "production"]).default("staging"), status: z.enum(["planned", "running", "passed", "failed"]), evidence: z.record(z.unknown()).default({}), note: z.string().max(4_000).optional().nullable() });

export async function GET() {
  try {
    const session = await requireAuth(); await assertAdminOperation(session, "system.security_center.manage");
    const [readiness, drills, gates] = await Promise.all([getProductionReadiness(), db.select().from(operationalDrills).orderBy(desc(operationalDrills.createdAt)).limit(100), db.select().from(releaseGateRuns).orderBy(desc(releaseGateRuns.createdAt)).limit(50)]);
    return ok({ readiness, drills, gates });
  } catch (error) { return handleApiError(error, "تعذر تحميل بوابة الإطلاق"); }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(); await assertAdminOperation(session, "system.security_center.manage");
    const payload = await request.json();
    if (payload?.action === "record_gate") {
      const readiness = await getProductionReadiness();
      const [gate] = await db.insert(releaseGateRuns).values({ environment: payload.environment === "production" ? "production" : "staging", status: readiness.dangerCount === 0 ? "passed" : "blocked", readinessScore: readiness.score, checks: { checks: readiness.checks, metrics: readiness.metrics }, source: "admin_readiness_snapshot", note: payload.note || null, executedBy: session.userId }).returning();
      await writeAuditLog({ actorId: session.userId, action: "create", category: "system", entityType: "release_gate_run", entityId: gate.id, afterData: gate });
      return created({ gate, message: "تم حفظ دليل بوابة الإطلاق الحالي" });
    }
    const drill = drillSchema.parse(payload);
    const [saved] = await db.insert(operationalDrills).values({ ...drill, startedAt: drill.status === "running" ? new Date() : null, completedAt: ["passed", "failed"].includes(drill.status) ? new Date() : null, executedBy: session.userId }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", category: "system", entityType: "operational_drill", entityId: saved.id, afterData: saved });
    return created({ drill: saved, message: "تم تسجيل دليل الاختبار التشغيلي" });
  } catch (error) { return handleApiError(error, "تعذر تسجيل بوابة الإطلاق"); }
}
