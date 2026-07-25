export const dynamic = "force-dynamic";

import Link from "next/link";
import { and, desc, eq, gte, ilike, lte, sql, type SQL } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { auditLogs, db, users } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || "" : value || "";

export default async function AuditLogPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await requireAuth();
  await assertAdmin(session, "security.manage");
  const params = searchParams ? await searchParams : {};
  const category = first(params.category);
  const actorId = first(params.actorId);
  const entity = first(params.entity);
  const correlationId = first(params.correlationId);
  const from = first(params.from);
  const to = first(params.to);
  const conditions: SQL[] = [];
  if (category) conditions.push(eq(auditLogs.category, category));
  if (actorId) conditions.push(eq(auditLogs.actorId, actorId));
  if (entity) conditions.push(ilike(auditLogs.entityType, `%${entity}%`));
  if (correlationId) conditions.push(eq(auditLogs.correlationId, correlationId));
  if (from && !Number.isNaN(new Date(from).getTime())) conditions.push(gte(auditLogs.createdAt, new Date(from)));
  if (to && !Number.isNaN(new Date(to).getTime())) conditions.push(lte(auditLogs.createdAt, new Date(`${to}T23:59:59.999Z`)));
  const items = await db.select({ id: auditLogs.id, action: auditLogs.action, category: auditLogs.category, entityType: auditLogs.entityType, entityId: auditLogs.entityId, createdAt: auditLogs.createdAt, actorName: users.fullName, actorId: auditLogs.actorId, ipAddress: auditLogs.ipAddress, correlationId: auditLogs.correlationId }).from(auditLogs).leftJoin(users, eq(auditLogs.actorId, users.id)).where(conditions.length ? and(...conditions) : sql`true`).orderBy(desc(auditLogs.createdAt)).limit(300);
  const qs = new URLSearchParams(); if (category) qs.set("category", category); if (actorId) qs.set("actorId", actorId); if (entity) qs.set("entity", entity); if (correlationId) qs.set("correlationId", correlationId); if (from) qs.set("from", from); if (to) qs.set("to", to); qs.set("format", "csv");
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">سجل العمليات والتدقيق</h1><p className="mt-2 text-sm text-slate-500">فلترة حسب التصنيف والفاعل والكيان والتاريخ، مع تصدير CSV غير قابل لتعديل السجل الأصلي.</p></div><div className="flex gap-2"><Button asChild variant="outline"><a href={`/api/admin/audit-log?${qs.toString()}`}>تصدير CSV</a></Button><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div></div><section className="rounded-3xl border bg-white p-6 shadow-card"><form action="/admin/audit-log" method="get" className="mb-5 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-6"><select name="category" defaultValue={category} className="h-11 rounded-xl border bg-white px-3 text-sm"><option value="">كل التصنيفات</option><option value="security">Security</option><option value="financial">Financial</option><option value="inventory">Inventory</option><option value="administrative">Administrative</option><option value="system">System</option></select><input name="actorId" defaultValue={actorId} placeholder="معرف الفاعل" className="h-11 rounded-xl border bg-white px-3 text-sm"/><input name="entity" defaultValue={entity} placeholder="نوع الكيان" className="h-11 rounded-xl border bg-white px-3 text-sm"/><input name="correlationId" defaultValue={correlationId} placeholder="Request / Correlation ID" className="h-11 rounded-xl border bg-white px-3 text-sm"/><input name="from" type="date" defaultValue={from} className="h-11 rounded-xl border bg-white px-3 text-sm"/><input name="to" type="date" defaultValue={to} className="h-11 rounded-xl border bg-white px-3 text-sm"/><div className="md:col-span-5 flex gap-2"><Button>تطبيق الفلاتر</Button><Button asChild variant="outline"><Link href="/admin/audit-log">تصفير</Link></Button></div></form>{!items.length ? <EmptyState title="لا توجد عمليات مطابقة" /> : <div className="overflow-x-auto rounded-2xl border"><table className="w-full min-w-[900px] text-right text-sm"><thead className="bg-slate-100"><tr><th className="p-3">التصنيف</th><th className="p-3">العملية</th><th className="p-3">الكيان</th><th className="p-3">الفاعل</th><th className="p-3">التاريخ</th><th className="p-3">IP</th><th className="p-3">Correlation</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t"><td className="p-3"><Badge variant={item.category === "security" ? "danger" : item.category === "financial" ? "warning" : item.category === "inventory" ? "success" : "outline"}>{item.category}</Badge></td><td className="p-3"><Badge variant="outline">{item.action}</Badge></td><td className="p-3 font-bold">{item.entityType}<div className="text-xs text-slate-400">{item.entityId}</div></td><td className="p-3">{item.actorName || "النظام"}<div className="text-[10px] text-slate-400">{item.actorId || "-"}</div></td><td className="p-3">{new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(item.createdAt)}</td><td className="p-3 text-slate-500">{item.ipAddress || "-"}</td><td className="p-3 font-mono text-[10px] text-slate-500">{item.correlationId || "-"}</td></tr>)}</tbody></table></div>}</section></section></main>;
}
