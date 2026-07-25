export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { desc } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { TenantForm } from "@/components/admin/tenant-form";
import { VerifyTenantDomainButton } from "@/components/admin/verify-tenant-domain-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { db, tenantDomains, tenants } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";

export default async function TenantsPage() {
  const session = await requireAuth();
  await assertAdmin(session, "tenants.manage");
  const [rows, domains] = await Promise.all([db.select().from(tenants).orderBy(desc(tenants.createdAt)).limit(200), db.select().from(tenantDomains).orderBy(desc(tenantDomains.createdAt)).limit(500)]);
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-black text-slate-950">SaaS Tenants</h1><p className="mt-2 text-sm text-slate-500">إدارة المستأجرين، الخطط، الدومينات والـ White Label.</p></div><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div><TenantForm/><div className="mt-8 grid gap-4 md:grid-cols-3">{rows.map((tenant)=><Card key={tenant.id}><CardHeader><CardTitle>{tenant.name}</CardTitle><p className="text-sm text-slate-500">/{tenant.slug}</p></CardHeader><CardContent><div className="flex flex-wrap gap-2"><Badge variant={tenant.status==='active'?'success':'warning'}>{tenant.status}</Badge><Badge variant="outline">{tenant.plan}</Badge>{tenant.isWhiteLabel?<Badge>White Label</Badge>:null}</div><p className="mt-4 text-sm text-slate-500">Currency: {tenant.defaultCurrency} • Locale: {tenant.defaultLocale}</p>{domains.filter((domain) => domain.tenantId === tenant.id).map((domain) => <div key={domain.id} className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600"><p>{domain.domain} — <span className={domain.status === "verified" ? "text-emerald-700" : "text-amber-700"}>{domain.status}</span></p>{domain.status !== "verified" && domain.verificationToken ? <><p className="mt-1 break-all text-slate-500">TXT value: {domain.verificationToken}</p><p className="mt-1 break-all text-slate-500">Record: _salah-tenant-verification.{domain.domain}</p><div className="mt-2"><VerifyTenantDomainButton domainId={domain.id} /></div></> : null}</div>)}</CardContent></Card>)}</div></section></main>;
}
