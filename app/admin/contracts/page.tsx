import Link from "next/link";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { ContractTemplateForm } from "@/components/admin/enterprise/contract-template-form";
import { ContractActions, ScanContractsButton } from "@/components/admin/contract-actions";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { contractEvents, contractTemplates, db, merchantContracts, stores, users } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { formatNumber } from "@/lib/utils";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

const statusLabels: Record<string,string> = { active:"نشط", near_expiry:"قريب الانتهاء", expired:"منتهي", grace:"فترة سماح", frozen:"مجمد", terminated:"منهى", pending_approval:"بانتظار اعتماد", pending_signature:"بانتظار توقيع", draft:"مسودة", renewal_requested:"طلب تجديد", renewed:"مجدد" };
function daysRemaining(endAt: Date) { return Math.ceil((new Date(endAt).getTime() - Date.now()) / (1000*60*60*24)); }

const defaultContractTemplates = [
  {
    name: "عقد تشغيل متجر قياسي",
    code: "standard_store_operation",
    version: "1.0",
    body: "عقد تشغيل متجر داخل منصة صلاح سنتر\n\nالطرف الأول: إدارة المنصة.\nالطرف الثاني: {{merchantName}} مالك متجر {{storeName}} رقم {{storeNumber}}.\n\nمدة العقد: {{durationDays}} يوم.\nالرسوم/الاشتراك: {{subscriptionFee}}.\nالعمولة: {{commissionRate}}%.\n\nيلتزم التاجر بسياسات المنصة وجودة البيانات والرد على الطلبات.",
    variables: ["merchantName", "storeName", "storeNumber", "durationDays", "subscriptionFee", "commissionRate"],
    isDefault: true,
    isActive: true
  },
  {
    name: "عقد فرع / محل إضافي",
    code: "store_branch_rent",
    version: "1.0",
    body: "عقد إيجار وتشغيل محل/فرع إضافي\n\nالشركة/المجموعة: {{companyName}}\nالفرع: {{branchName}}\nرقم المحل: {{storeNumber}}\nالإيجار: {{rentAmount}} {{rentCurrency}}\nدورة الإيجار: {{rentCycle}}\n\nيخضع الفرع لنفس حساب التاجر مع استقلال الطلبات والمخزون والفواتير.",
    variables: ["companyName", "branchName", "storeNumber", "rentAmount", "rentCurrency", "rentCycle"],
    isDefault: false,
    isActive: true
  },
  {
    name: "عقد تجديد متجر",
    code: "store_renewal",
    version: "1.0",
    body: "ملحق تجديد عقد متجر\n\nالمتجر: {{storeName}}\nرقم العقد السابق: {{oldContractNumber}}\nتاريخ البداية الجديد: {{startAt}}\nتاريخ الانتهاء الجديد: {{endAt}}\n\nيقر الطرفان باستمرار الالتزامات السابقة مع المدة الجديدة.",
    variables: ["storeName", "oldContractNumber", "startAt", "endAt"],
    isDefault: false,
    isActive: true
  }
];

export default async function ContractsAdminPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; report?: string }> }) {
  const session = await requireAuth();
  await assertAdmin(session, "contracts.manage");
  const sp = await searchParams;
  if (hasDatabase()) await db.insert(contractTemplates).values(defaultContractTemplates).onConflictDoNothing();
  const q = sp.q?.trim();
  const status = sp.status;
  const nearOnly = sp.report === "near-expiry";
  const filters = [];
  if (status && status !== "all") filters.push(eq(merchantContracts.status, status as any));
  if (q) filters.push(or(ilike(merchantContracts.contractNumber, `%${q}%`), ilike(stores.name, `%${q}%`), ilike(stores.storeNumber, `%${q}%`), ilike(users.fullName, `%${q}%`))!);
  if (nearOnly) filters.push(sql`${merchantContracts.endAt} <= now() + (${merchantContracts.alertBeforeDays} || ' days')::interval`);
  const where = hasDatabase() && filters.length ? and(...filters) : undefined;

  const [contracts, templates, events] = hasDatabase() ? await Promise.all([
    db.select({ contract: merchantContracts, store: stores, merchant: users }).from(merchantContracts).innerJoin(stores, eq(merchantContracts.storeId, stores.id)).innerJoin(users, eq(merchantContracts.merchantId, users.id)).where(where).orderBy(asc(merchantContracts.endAt)).limit(200),
    db.select().from(contractTemplates).orderBy(desc(contractTemplates.createdAt)).limit(50),
    db.select().from(contractEvents).orderBy(desc(contractEvents.createdAt)).limit(80)
  ]) : [[], [], []];

  const active = contracts.filter((r) => ["active", "near_expiry", "grace"].includes(r.contract.status)).length;
  const expired = contracts.filter((r) => r.contract.status === "expired").length;
  const frozen = contracts.filter((r) => r.contract.status === "frozen").length;
  const near = contracts.filter((r) => daysRemaining(r.contract.endAt) <= r.contract.alertBeforeDays).length;

  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><h1 className="text-3xl font-black text-slate-950">إدارة العقود</h1><p className="mt-2 text-sm text-slate-500">العقود النشطة والمنتهية والمعلقة والمجمدة مع تنبيهات قرب الانتهاء وإجراءات التجديد والسماح والتجميد.</p></div><div className="flex flex-wrap gap-2"><ScanContractsButton/><Button asChild variant="outline"><Link href="/admin/stores/frozen">المتاجر المجمدة</Link></Button><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div></div>
  <div className="mb-6 grid gap-4 md:grid-cols-4"><Stat title="عقود فعالة" value={active}/><Stat title="قريبة الانتهاء" value={near}/><Stat title="منتهية" value={expired}/><Stat title="مجمدة" value={frozen}/></div>
  <form className="mb-6 grid gap-3 rounded-3xl border bg-white p-4 shadow-card md:grid-cols-[1fr_220px_180px_auto]"><input name="q" defaultValue={q||""} placeholder="بحث برقم العقد، المتجر، التاجر" className="h-11 rounded-xl border px-4 text-sm"/><select name="status" defaultValue={status||"all"} className="h-11 rounded-xl border px-4 text-sm"><option value="all">كل الحالات</option>{Object.entries(statusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select name="report" defaultValue={sp.report||""} className="h-11 rounded-xl border px-4 text-sm"><option value="">كل التقارير</option><option value="near-expiry">العقود قريبة الانتهاء</option></select><Button>تصفية</Button></form>
  {!contracts.length?<EmptyState title="لا توجد عقود"/>:<div className="overflow-hidden rounded-3xl border bg-white shadow-card"><div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-right text-sm"><thead className="bg-slate-100"><tr><th className="p-4">رقم العقد</th><th className="p-4">المتجر</th><th className="p-4">رقم المتجر</th><th className="p-4">التاجر</th><th className="p-4">البداية</th><th className="p-4">النهاية</th><th className="p-4">الأيام المتبقية</th><th className="p-4">الحالة</th><th className="p-4">الإجراء المطلوب</th><th className="p-4">إجراءات</th></tr></thead><tbody className="divide-y">{contracts.map(({contract,store,merchant})=>{const days=daysRemaining(contract.endAt); const action=contract.status==="frozen"?"إعادة فتح المتجر":days<0?"تجديد أو إنهاء":days<=contract.alertBeforeDays?"تجديد / سماح / إنهاء":"متابعة"; return <tr key={contract.id}><td className="p-4 font-black">{contract.contractNumber}</td><td className="p-4">{store.name}</td><td className="p-4 font-bold text-primary">{store.storeNumber}</td><td className="p-4">{merchant.fullName}</td><td className="p-4">{new Intl.DateTimeFormat("ar").format(contract.startAt)}</td><td className="p-4">{new Intl.DateTimeFormat("ar").format(contract.endAt)}</td><td className="p-4 font-black">{formatNumber(days)}</td><td className="p-4"><Badge variant={contract.status==="active"?"success":contract.status==="frozen"?"danger":"warning"}>{statusLabels[contract.status]||contract.status}</Badge></td><td className="p-4">{action}</td><td className="p-4"><ContractActions contractId={contract.id} status={contract.status}/></td></tr>})}</tbody></table></div></div>}
  <div className="mt-8 grid gap-8 lg:grid-cols-2"><div><h2 className="mb-4 text-xl font-black">قوالب العقود الافتراضية</h2><div className="mb-4 rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm leading-7 text-blue-900"><p className="font-black">شرح المتغيرات داخل العقد</p><p className="mt-2">اكتب المتغيرات بين قوسين مزدوجين مثل <b>{`{{storeName}}`}</b> وسيستبدلها النظام عند إنشاء العقد. أمثلة: اسم التاجر، اسم المتجر، رقم المتجر، مدة العقد، الإيجار، العمولة.</p><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline">merchantName</Badge><Badge variant="outline">storeName</Badge><Badge variant="outline">storeNumber</Badge><Badge variant="outline">rentAmount</Badge><Badge variant="outline">commissionRate</Badge></div></div><ContractTemplateForm/></div><div><h2 className="mb-4 text-xl font-black">سجل عمليات العقود</h2>{!events.length?<EmptyState title="لا توجد عمليات"/>:<div className="max-h-[620px] space-y-3 overflow-auto">{events.map(e=><article key={e.id} className="rounded-2xl border bg-white p-4 shadow-card"><div className="flex items-center justify-between"><Badge variant="outline">{e.action}</Badge><span className="text-xs text-slate-500">{new Intl.DateTimeFormat("ar",{dateStyle:"short",timeStyle:"short"}).format(e.createdAt)}</span></div>{e.reason?<p className="mt-2 text-sm text-slate-600">{e.reason}</p>:null}</article>)}</div>}</div></div>
  </section></main>;
}
function Stat({title,value}:{title:string;value:number}){return <div className="rounded-3xl border bg-white p-5 shadow-card"><p className="text-sm font-bold text-slate-500">{title}</p><p className="mt-2 text-3xl font-black text-slate-950">{formatNumber(value)}</p></div>}
