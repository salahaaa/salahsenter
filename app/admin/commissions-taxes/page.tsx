import Link from "next/link";
import { asc } from "drizzle-orm";
import { CommissionRuleForm, TaxRuleForm } from "@/components/admin/enterprise/rule-forms";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { commissionRules, db, taxRules } from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
export default async function CommissionsTaxesPage(){
  const session = await requireAuth();
  await assertAdmin(session, "commissions.manage");const [commissions,taxes]=hasDatabase()?await Promise.all([db.select().from(commissionRules).orderBy(asc(commissionRules.priority)),db.select().from(taxRules).orderBy(asc(taxRules.priority))]):[[],[]];return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-black text-slate-950">العمولات والضرائب</h1><p className="mt-2 text-sm text-slate-500">قواعد عمولة وضريبة قابلة للتخصيص حسب المنصة والجناح والمتجر والموقع.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div><div className="grid gap-8 lg:grid-cols-2"><div><h2 className="mb-4 text-xl font-black">إضافة عمولة</h2><CommissionRuleForm/></div><div><h2 className="mb-4 text-xl font-black">إضافة ضريبة</h2><TaxRuleForm/></div></div><div className="mt-8 grid gap-8 lg:grid-cols-2"><RuleList title="قواعد العمولات" items={commissions.map(r=>({id:r.id,title:r.name,meta:`${r.rate}% + ${r.fixedFee}`,active:r.isActive}))}/><RuleList title="قواعد الضرائب" items={taxes.map(r=>({id:r.id,title:r.name,meta:`${r.rate}%`,active:r.isActive}))}/></div></section></main>}
function RuleList({title,items}:{title:string;items:Array<{id:string;title:string;meta:string;active:boolean}>}){return <div><h2 className="mb-4 text-xl font-black">{title}</h2>{!items.length?<EmptyState title="لا توجد قواعد"/>:<div className="space-y-3">{items.map(i=><article key={i.id} className="rounded-2xl border bg-white p-4 shadow-card"><div className="flex items-center justify-between"><div><h3 className="font-black">{i.title}</h3><p className="text-xs text-slate-500">{i.meta}</p></div><Badge variant={i.active?"success":"outline"}>{i.active?"نشط":"معطل"}</Badge></div></article>)}</div>}</div>}
