import { and, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { auditLogs, db, securityAlerts, users } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { createOrRefreshIncident, sendSmartAlert, writeStructuredLog } from "@/lib/admin/platform-protection-center";

export type SecurityAlertInput = {
  severity: "low" | "medium" | "high" | "critical";
  type: string;
  title: string;
  description?: string;
  actorId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  evidence?: Record<string, unknown>;
  recommendedAction?: string;
};

export async function createSecurityAlert(input: SecurityAlertInput) {
  const [existing] = await db
    .select()
    .from(securityAlerts)
    .where(
      and(
        eq(securityAlerts.status, "open"),
        eq(securityAlerts.type, input.type),
        input.ipAddress ? eq(securityAlerts.ipAddress, input.ipAddress) : isNull(securityAlerts.ipAddress),
        input.actorId ? eq(securityAlerts.actorId, input.actorId) : isNull(securityAlerts.actorId)
      )
    )
    .limit(1);

  if (existing) return existing;

  const [alert] = await db
    .insert(securityAlerts)
    .values({
      severity: input.severity,
      type: input.type,
      title: input.title,
      description: input.description,
      actorId: input.actorId || null,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      evidence: input.evidence || {},
      recommendedAction: input.recommendedAction
    })
    .returning();
  return alert;
}

export async function scanSuspiciousActivity() {
  if (!hasDatabase()) return [];
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const created = [];

  const failedLoginsByIp = await db
    .select({ ipAddress: auditLogs.ipAddress, count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, "login"), gte(auditLogs.createdAt, since), sql`${auditLogs.afterData}->>'success' = 'false'`))
    .groupBy(auditLogs.ipAddress)
    .having(sql`count(*) >= 5`);

  for (const row of failedLoginsByIp) {
    created.push(await createSecurityAlert({
      severity: Number(row.count) >= 10 ? "critical" : "high",
      type: "multiple_failed_logins",
      title: "محاولات دخول فاشلة متكررة",
      description: `تم رصد ${row.count} محاولات دخول فاشلة خلال آخر ساعة من نفس العنوان.`,
      ipAddress: row.ipAddress,
      evidence: { count: row.count, window: "1h" },
      recommendedAction: "راجع العنوان، غيّر كلمات مرور الحسابات المتأثرة إن وجدت، وفعل إيقاف التسجيل/الدخول مؤقتاً إذا تكررت المحاولات."
    }));
  }

  const destructiveByActor = await db
    .select({ actorId: auditLogs.actorId, count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, "delete"), gte(auditLogs.createdAt, since)))
    .groupBy(auditLogs.actorId)
    .having(sql`count(*) >= 5`);

  for (const row of destructiveByActor) {
    created.push(await createSecurityAlert({
      severity: "critical",
      type: "mass_delete_activity",
      title: "حذف جماعي مشبوه",
      description: `تم رصد ${row.count} عمليات حذف خلال آخر ساعة من نفس المستخدم.`,
      actorId: row.actorId,
      evidence: { count: row.count, window: "1h" },
      recommendedAction: "أوقف حساب المستخدم مؤقتاً، راجع سجل التدقيق، ثم فعّل وضع الإيقاف الطارئ إذا كانت العمليات غير مصرح بها."
    }));
  }

  const updatesByActor = await db
    .select({ actorId: auditLogs.actorId, count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(and(or(eq(auditLogs.action, "update"), eq(auditLogs.action, "status_change")), gte(auditLogs.createdAt, since)))
    .groupBy(auditLogs.actorId)
    .having(sql`count(*) >= 30`);

  for (const row of updatesByActor) {
    created.push(await createSecurityAlert({
      severity: "medium",
      type: "high_volume_updates",
      title: "تعديلات كثيرة خلال وقت قصير",
      description: `تم رصد ${row.count} عملية تعديل خلال آخر ساعة من نفس المستخدم.`,
      actorId: row.actorId,
      evidence: { count: row.count, window: "1h" },
      recommendedAction: "تحقق من أن العمليات تمت بواسطة مستخدم مصرح، وراجع آخر التعديلات في Audit Log."
    }));
  }

  const highVolumeByIp = await db
    .select({ ipAddress: auditLogs.ipAddress, count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(gte(auditLogs.createdAt, since))
    .groupBy(auditLogs.ipAddress)
    .having(sql`count(*) >= 120`);

  for (const row of highVolumeByIp) {
    created.push(await createSecurityAlert({
      severity: Number(row.count) >= 300 ? "critical" : "high",
      type: "api_abuse_or_spam_requests",
      title: "استخدام API أو نشاط إداري كثيف من IP واحد",
      description: `تم رصد ${row.count} حدث تدقيق خلال آخر ساعة من نفس العنوان، وهذا قد يدل على spam/API abuse أو عملية آلية غير مضبوطة.`,
      ipAddress: row.ipAddress,
      evidence: { count: row.count, window: "1h" },
      recommendedAction: "راجع مصدر الطلبات، طبّق rate limiting أو حظر مؤقت عبر WAF إذا كان النشاط غير مصرح."
    }));
  }

  const passwordResetByIp = await db
    .select({ ipAddress: auditLogs.ipAddress, count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(and(eq(auditLogs.entityType, "password_reset_request"), gte(auditLogs.createdAt, since)))
    .groupBy(auditLogs.ipAddress)
    .having(sql`count(*) >= 10`);

  for (const row of passwordResetByIp) {
    created.push(await createSecurityAlert({
      severity: "high",
      type: "password_reset_abuse",
      title: "طلبات استعادة كلمة مرور متكررة",
      description: `تم رصد ${row.count} طلب استعادة كلمة مرور خلال آخر ساعة من نفس العنوان.`,
      ipAddress: row.ipAddress,
      evidence: { count: row.count, window: "1h" },
      recommendedAction: "ارفع rate limit لاستعادة كلمة المرور، وراجع الحسابات المستهدفة."
    }));
  }

  for (const alert of created.filter((item) => item && ["high", "critical"].includes(item.severity))) {
    await createOrRefreshIncident({
      incidentKey: `security:${alert.type}:${alert.ipAddress || alert.actorId || "global"}`,
      severity: alert.severity === "critical" ? "critical" : "warning",
      title: alert.title,
      description: alert.description || undefined,
      affectedService: "security",
      recommendation: alert.recommendedAction || undefined,
      metadata: { alertId: alert.id, evidence: alert.evidence }
    });
    await sendSmartAlert({
      severity: alert.severity === "critical" ? "critical" : "warning",
      title: alert.title,
      message: alert.description || alert.type,
      metadata: { alertId: alert.id, evidence: alert.evidence }
    });
  }

  await writeStructuredLog({ level: created.some((item) => item?.severity === "critical") ? "critical" : created.length ? "warn" : "info", category: "security_scan", service: "security", message: `Security scan completed with ${created.length} findings`, metadata: { findings: created.length } });
  return created;
}

export async function getSecurityCenterData() {
  if (!hasDatabase()) return { alerts: [], metrics: { open: 0, critical: 0, high: 0, investigating: 0 }, recentLogins: [] };

  const [alerts, open, critical, high, investigating, recentLogins] = await Promise.all([
    db.select({ alert: securityAlerts, actorName: users.fullName, actorEmail: users.email }).from(securityAlerts).leftJoin(users, eq(securityAlerts.actorId, users.id)).orderBy(desc(securityAlerts.createdAt)).limit(100),
    db.select({ count: sql<number>`count(*)::int` }).from(securityAlerts).where(eq(securityAlerts.status, "open")),
    db.select({ count: sql<number>`count(*)::int` }).from(securityAlerts).where(and(eq(securityAlerts.status, "open"), eq(securityAlerts.severity, "critical"))),
    db.select({ count: sql<number>`count(*)::int` }).from(securityAlerts).where(and(eq(securityAlerts.status, "open"), eq(securityAlerts.severity, "high"))),
    db.select({ count: sql<number>`count(*)::int` }).from(securityAlerts).where(eq(securityAlerts.status, "investigating")),
    db.select().from(auditLogs).where(eq(auditLogs.action, "login")).orderBy(desc(auditLogs.createdAt)).limit(20)
  ]);

  return {
    alerts,
    metrics: {
      open: Number(open[0]?.count || 0),
      critical: Number(critical[0]?.count || 0),
      high: Number(high[0]?.count || 0),
      investigating: Number(investigating[0]?.count || 0)
    },
    recentLogins
  };
}
