export const dynamic = "force-dynamic";

import { and, desc, eq, gte, ilike, lte, sql, type SQL } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { auditLogs, db, users } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/[\r\n]+/g, " ");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    const url = new URL(request.url);
    const category = url.searchParams.get("category") || "";
    const actorId = url.searchParams.get("actorId") || "";
    const entity = url.searchParams.get("entity") || "";
    const correlationId = url.searchParams.get("correlationId") || "";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const format = url.searchParams.get("format") || "json";
    const conditions: SQL[] = [];
    if (category) conditions.push(eq(auditLogs.category, category));
    if (actorId) conditions.push(eq(auditLogs.actorId, actorId));
    if (entity) conditions.push(ilike(auditLogs.entityType, `%${entity}%`));
    if (correlationId) conditions.push(eq(auditLogs.correlationId, correlationId));
    if (from && !Number.isNaN(new Date(from).getTime())) conditions.push(gte(auditLogs.createdAt, new Date(from)));
    if (to && !Number.isNaN(new Date(to).getTime())) conditions.push(lte(auditLogs.createdAt, new Date(`${to}T23:59:59.999Z`)));
    const rows = await db.select({ id: auditLogs.id, category: auditLogs.category, action: auditLogs.action, entityType: auditLogs.entityType, entityId: auditLogs.entityId, createdAt: auditLogs.createdAt, actorName: users.fullName, actorId: auditLogs.actorId, ipAddress: auditLogs.ipAddress, correlationId: auditLogs.correlationId }).from(auditLogs).leftJoin(users, eq(auditLogs.actorId, users.id)).where(conditions.length ? and(...conditions) : sql`true`).orderBy(desc(auditLogs.createdAt)).limit(format === "csv" ? 10_000 : 300);
    if (format === "csv") {
      const header = ["id", "category", "action", "entity_type", "entity_id", "actor", "actor_id", "created_at", "ip_address", "correlation_id"];
      const body = rows.map((row) => [row.id, row.category, row.action, row.entityType, row.entityId, row.actorName || "system", row.actorId, row.createdAt.toISOString(), row.ipAddress, row.correlationId].map(csvCell).join(",")).join("\n");
      return new Response(`\uFEFF${header.map(csvCell).join(",")}\n${body}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=admin-audit-log.csv", "Cache-Control": "no-store" } });
    }
    return ok({ items: rows });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل سجل العمليات");
  }
}
