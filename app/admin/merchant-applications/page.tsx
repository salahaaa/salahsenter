import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SiteHeader } from "@/components/layout/site-header";
import { MerchantApplicationActions } from "@/components/admin/merchant-application-actions";
import { db, merchantApplications } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

type SearchParams = Record<string, string | string[] | undefined>;
const statuses = ["new", "pending", "under_review", "waiting_for_data", "documents_required", "pre_approved", "contract_created", "contract_signed", "waiting_final_approval", "approved", "active", "rejected"] as const;
const statusLabels: Record<string, string> = { new: "جديد", pending: "قيد التقديم", under_review: "قيد المراجعة", waiting_for_data: "بانتظار استكمال البيانات", documents_required: "مطلوب مستندات", pre_approved: "قبول مبدئي", contract_created: "تم إنشاء العقد", contract_signed: "تم توقيع العقد", waiting_final_approval: "بانتظار الموافقة النهائية", approved: "معتمد", active: "مفعل", rejected: "مرفوض" };
function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
function toPage(value: string | string[] | undefined) { const page = Number(first(value) || 1); return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1; }
function href(filters: { q: string; status: string }, page: number) { const p = new URLSearchParams(); if (filters.q) p.set("q", filters.q); if (filters.status) p.set("status", filters.status); if (page > 1) p.set("page", String(page)); const q = p.toString(); return q ? `/admin/merchant-applications?${q}` : "/admin/merchant-applications"; }

export default async function MerchantApplicationsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await requireAuth();
  await assertAdmin(session, "merchant_applications.manage");
  const params = searchParams ? await searchParams : {};
  const q = first(params.q).trim();
  const rawStatus = first(params.status);
  const status = statuses.includes(rawStatus as any) ? rawStatus : "";
  const page = toPage(params.page);
  const pageSize = 50;
  const conditions: SQL[] = [];
  if (q) { const term = `%${q}%`; conditions.push(or(ilike(merchantApplications.storeName, term), ilike(merchantApplications.applicantName, term), ilike(merchantApplications.applicantEmail, term), ilike(merchantApplications.applicantPhone, term), ilike(merchantApplications.businessActivity, term))!); }
  if (status) conditions.push(eq(merchantApplications.status, status as any));
  const rows = hasDatabase() ? await db.select().from(merchantApplications).where(conditions.length ? and(...conditions) : sql`true`).orderBy(desc(merchantApplications.createdAt)).limit(pageSize + 1).offset((page - 1) * pageSize) : [];
  const applications = rows.slice(0, pageSize);
  const hasNext = rows.length > pageSize;
  const filters = { q, status };

  return <main className="min-h-screen admin-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">طلبات فتح المتاجر</h1><p className="mt-2 text-sm text-slate-500">جدول سريع للبحث والفلترة ومراجعة الطلبات حسب مراحل الاعتماد والعقد.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div><section className="rounded-3xl border bg-white p-6 shadow-card"><form action="/admin/merchant-applications" method="get" className="mb-5 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_240px_auto_auto]"><input name="q" defaultValue={q} placeholder="بحث باسم المتجر، المتقدم، البريد، الهاتف أو النشاط" className="h-11 rounded-xl border bg-white px-4 text-sm"/><select name="status" defaultValue={status} className="h-11 rounded-xl border bg-white px-4 text-sm"><option value="">كل الحالات</option>{statuses.map((item)=><option key={item} value={item}>{statusLabels[item]}</option>)}</select><Button>بحث / فلترة</Button><Button asChild variant="outline"><Link href="/admin/merchant-applications">تصفير</Link></Button></form>{!applications.length ? <EmptyState title="لا توجد طلبات مطابقة" description="ستظهر طلبات فتح المتاجر هنا فور إرسالها من العملاء." /> : <div className="overflow-x-auto rounded-2xl border"><table className="w-full min-w-[1050px] text-right text-sm"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-3">المتجر</th><th className="p-3">مقدم الطلب</th><th className="p-3">النشاط</th><th className="p-3">الحالة</th><th className="p-3">تاريخ الطلب</th><th className="p-3">إجراءات</th></tr></thead><tbody>{applications.map((application)=><tr key={application.id} className="border-t hover:bg-slate-50"><td className="p-3 font-black text-slate-950">{application.storeName}</td><td className="p-3"><div className="font-bold">{application.applicantName}</div><div className="text-xs text-slate-500">{application.applicantEmail}</div></td><td className="p-3 text-slate-600">{application.businessActivity}</td><td className="p-3"><Badge variant={application.status === "approved" || application.status === "active" ? "success" : application.status === "rejected" ? "danger" : "warning"}>{statusLabels[application.status]}</Badge></td><td className="p-3 text-slate-500">{new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(application.createdAt)}</td><td className="p-3"><div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href={`/admin/merchant-applications/${application.id}`}>مراجعة</Link></Button><MerchantApplicationActions id={application.id} status={application.status} /></div></td></tr>)}</tbody></table></div>}<div className="mt-5 flex items-center justify-between gap-3 text-sm font-bold text-slate-500"><span>الصفحة {page} — 50 نتيجة كحد أقصى.</span><div className="flex gap-2">{page > 1 ? <Button asChild size="sm" variant="outline"><Link href={href(filters, page - 1)}>السابق</Link></Button> : null}{hasNext ? <Button asChild size="sm" variant="outline"><Link href={href(filters, page + 1)}>التالي</Link></Button> : null}</div></div></section></section></main>;
}
