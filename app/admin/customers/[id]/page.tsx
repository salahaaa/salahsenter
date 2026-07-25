export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { auditLogs, customerAddresses, db, orders, paymentReceipts, returnRequests, userSessions, users, wallets } from "@/lib/db";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default async function Customer360Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth();
  await assertAdmin(session, "users.manage");
  const [customer] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!customer) notFound();
  const [ordersRows, addresses, returns, receipts, activeSessions, audit, wallet] = await Promise.all([
    db.select({ id: orders.id, number: orders.orderNumber, storeId: orders.storeId, status: orders.statusCode, paymentStatus: orders.paymentStatus, total: orders.grandTotal, currency: orders.currency, createdAt: orders.createdAt }).from(orders).where(eq(orders.customerId, customer.id)).orderBy(desc(orders.createdAt)).limit(30),
    db.select().from(customerAddresses).where(eq(customerAddresses.userId, customer.id)).orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.createdAt)).limit(20),
    db.select().from(returnRequests).where(eq(returnRequests.customerId, customer.id)).orderBy(desc(returnRequests.createdAt)).limit(30),
    db.select().from(paymentReceipts).where(eq(paymentReceipts.userId, customer.id)).orderBy(desc(paymentReceipts.createdAt)).limit(30),
    db.select({ id: userSessions.id, deviceId: userSessions.deviceId, ipAddress: userSessions.ipAddress, lastSeenAt: userSessions.lastSeenAt, expiresAt: userSessions.expiresAt }).from(userSessions).where(and(eq(userSessions.userId, customer.id), isNull(userSessions.revokedAt))).orderBy(desc(userSessions.lastSeenAt)).limit(20),
    db.select({ id: auditLogs.id, action: auditLogs.action, category: auditLogs.category, entityType: auditLogs.entityType, entityId: auditLogs.entityId, createdAt: auditLogs.createdAt }).from(auditLogs).where(eq(auditLogs.actorId, customer.id)).orderBy(desc(auditLogs.createdAt)).limit(30),
    db.select().from(wallets).where(eq(wallets.userId, customer.id)).limit(1).then((rows) => rows[0] || null)
  ]);
  const totals = ordersRows.reduce((acc, row) => ({ count: acc.count + 1, amount: acc.amount + Number(row.total || 0) }), { count: 0, amount: 0 });
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">ملف العميل 360°</h1><p className="mt-2 text-sm text-slate-500">عرض مقيد بالصلاحيات للطلبات والعناوين والمرتجعات والمدفوعات والجلسات وسجل العمليات.</p></div><Button asChild variant="outline"><Link href="/admin/users">العودة للمستخدمين</Link></Button></div><section className="rounded-[2rem] border bg-white p-6 shadow-card"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-black">{customer.fullName}</h2><p className="mt-1 text-sm text-slate-500">{customer.email} · {customer.phone || "بدون هاتف"}</p></div><Badge variant={customer.status === "active" ? "success" : customer.status === "suspended" ? "danger" : "warning"}>{customer.status}</Badge></div><div className="mt-5 grid gap-3 md:grid-cols-4"><Metric title="إجمالي الطلبات" value={formatNumber(totals.count)} /><Metric title="قيمة الطلبات" value={formatCurrency(totals.amount)} /><Metric title="طلبات الإرجاع" value={formatNumber(returns.length)} /><Metric title="جلسات نشطة" value={formatNumber(activeSessions.length)} /></div>{wallet ? <p className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-bold text-blue-900">المحفظة: {formatCurrency(wallet.availableBalance, wallet.currency)} متاح · {formatCurrency(wallet.balance, wallet.currency)} إجمالي</p> : null}</section><div className="mt-8 grid gap-6 xl:grid-cols-2"><Panel title="آخر الطلبات">{ordersRows.map((row) => <Row key={row.id} title={row.number} meta={`${row.status} · ${row.paymentStatus} · ${formatCurrency(row.total, row.currency)}`} date={row.createdAt} />)}</Panel><Panel title="العناوين المحفوظة">{addresses.map((row) => <Row key={row.id} title={`${row.label}${row.isDefault ? " — افتراضي" : ""}`} meta={`${row.recipientName} · ${row.phone} · ${row.cityText || ""} ${row.addressLine}`} date={row.createdAt} />)}</Panel><Panel title="المرتجعات">{returns.map((row) => <Row key={row.id} title={row.reason} meta={`${row.status} · ${formatCurrency(row.refundAmount || 0, "YER")}`} date={row.createdAt} />)}</Panel><Panel title="إثباتات الدفع">{receipts.map((row) => <Row key={row.id} title={row.status} meta={`${row.provider} · ${row.transactionReference || "بدون مرجع"}`} date={row.createdAt} />)}</Panel><Panel title="الجلسات النشطة">{activeSessions.map((row) => <Row key={row.id} title={row.deviceId || "جهاز غير معروف"} meta={`${row.ipAddress || "-"} · آخر نشاط ${row.lastSeenAt ? new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(row.lastSeenAt) : "-"}`} date={row.expiresAt} />)}</Panel><Panel title="آخر العمليات">{audit.map((row) => <Row key={row.id} title={`${row.category} / ${row.action}`} meta={`${row.entityType} · ${row.entityId || "-"}`} date={row.createdAt} />)}</Panel></div></section></main>;
}
function Metric({ title, value }: { title: string; value: string }) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">{title}</p><p className="mt-1 text-xl font-black">{value}</p></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { const has = Array.isArray(children) ? children.length : Boolean(children); return <section className="rounded-[2rem] border bg-white p-6 shadow-card"><h2 className="mb-4 text-xl font-black">{title}</h2>{has ? <div className="space-y-2">{children}</div> : <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">لا توجد بيانات.</p>}</section>; }
function Row({ title, meta, date }: { title: string; meta: string; date: Date }) { return <div className="rounded-2xl bg-slate-50 p-3"><p className="font-black">{title}</p><p className="mt-1 text-xs text-slate-500">{meta}</p><p className="mt-1 text-[11px] text-slate-400">{new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(date)}</p></div>; }
