import Link from "next/link";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RevokeUserSessionsButton } from "@/components/admin/revoke-user-sessions-button";
import { db, users } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";

type SearchParams = Record<string, string | string[] | undefined>;
const statuses = ["active", "pending", "suspended", "deleted"] as const;
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
function toPage(value: string | string[] | undefined) { const page = Number(first(value) || 1); return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1; }
function href(filters: { q: string; status: string }, page: number) { const p = new URLSearchParams(); if (filters.q) p.set("q", filters.q); if (filters.status) p.set("status", filters.status); if (page > 1) p.set("page", String(page)); const q = p.toString(); return q ? `/admin/users?${q}` : "/admin/users"; }

export default async function AdminUsersPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await requireAuth();
  await assertAdminOperation(session, "customers.view");
  const params = searchParams ? await searchParams : {};
  const q = first(params.q).trim();
  const rawStatus = first(params.status);
  const status = statuses.includes(rawStatus as any) ? rawStatus : "";
  const page = toPage(params.page);
  const pageSize = 50;
  const conditions: SQL[] = [];
  if (q) { const term = `%${q}%`; conditions.push(or(ilike(users.fullName, term), ilike(users.email, term), ilike(users.phone, term))!); }
  if (status) conditions.push(eq(users.status, status as any));
  const rows = hasDatabase() ? await db.select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone, status: users.status, createdAt: users.createdAt }).from(users).where(conditions.length ? and(...conditions) : sql`true`).orderBy(desc(users.createdAt)).limit(pageSize + 1).offset((page - 1) * pageSize) : [];
  const items = rows.slice(0, pageSize);
  const hasNext = rows.length > pageSize;
  const filters = { q, status };
  return <main className="min-h-screen admin-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">المستخدمون والعملاء</h1><p className="mt-2 text-sm text-slate-500">جدول سريع مع بحث وفلترة وصفحات بدلاً من بطاقات طويلة.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div><section className="rounded-3xl border bg-white p-6 shadow-card"><form action="/admin/users" method="get" className="mb-5 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_180px_auto_auto]"><input name="q" defaultValue={q} placeholder="بحث بالاسم، البريد أو الهاتف" className="h-11 rounded-xl border bg-white px-4 text-sm"/><select name="status" defaultValue={status} className="h-11 rounded-xl border bg-white px-4 text-sm"><option value="">كل الحالات</option><option value="active">نشط</option><option value="pending">قيد الانتظار</option><option value="suspended">موقوف</option><option value="deleted">محذوف</option></select><Button>بحث / فلترة</Button><Button asChild variant="outline"><Link href="/admin/users">تصفير</Link></Button></form>{!items.length ? <EmptyState title="لا يوجد مستخدمون مطابقون" /> : <div className="overflow-x-auto rounded-2xl border"><table className="w-full min-w-[850px] text-right text-sm"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-3">المستخدم</th><th className="p-3">البريد</th><th className="p-3">الهاتف</th><th className="p-3">الحالة</th><th className="p-3">تاريخ التسجيل</th><th className="p-3">الأمان</th></tr></thead><tbody>{items.map((item)=><tr key={item.id} className="border-t hover:bg-slate-50"><td className="p-3 font-black text-slate-950"><Link href={`/admin/customers/${item.id}`} className="hover:text-primary hover:underline">{item.fullName}</Link></td><td className="p-3">{item.email}</td><td className="p-3">{item.phone || "-"}</td><td className="p-3"><Badge variant={item.status === "active" ? "success" : item.status === "suspended" ? "danger" : "warning"}>{item.status}</Badge></td><td className="p-3 text-slate-500">{new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(item.createdAt)}</td><td className="p-3"><RevokeUserSessionsButton userId={item.id} userName={item.fullName} /></td></tr>)}</tbody></table></div>}<div className="mt-5 flex items-center justify-between gap-3 text-sm font-bold text-slate-500"><span>الصفحة {page} — 50 نتيجة كحد أقصى.</span><div className="flex gap-2">{page > 1 ? <Button asChild size="sm" variant="outline"><Link href={href(filters, page - 1)}>السابق</Link></Button> : null}{hasNext ? <Button asChild size="sm" variant="outline"><Link href={href(filters, page + 1)}>التالي</Link></Button> : null}</div></div></section></section></main>;
}
