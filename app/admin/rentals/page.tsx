export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { Building2 } from "lucide-react";
import { RentalCollectionsPanel } from "@/components/admin/rental-collections-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { getAdminRentalCollections } from "@/lib/rentals/service";
import { assertAdmin } from "@/lib/rbac";

export default async function AdminRentalsPage() {
  const session = await requireAuth();
  await assertAdmin(session, "contracts.manage");
  const data = await getAdminRentalCollections();
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700"><Building2 className="h-4 w-4"/> Hybrid Rental Billing</div><h1 className="text-3xl font-black text-slate-950 md:text-5xl">تحصيل إيجارات المتاجر والإضافات</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">إدارة اتفاقات الإيجار، الإضافات المدفوعة، فواتير الاستحقاق، التأخير، والسداد دون خلطها بمدفوعات طلبات العملاء.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/admin/contracts">العقود القانونية</Link></Button><Button asChild variant="outline"><Link href="/admin/subscriptions">باقات الإيجار</Link></Button><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div></div><RentalCollectionsPanel agreements={data.agreements as any[]} invoices={data.invoices as any[]} addons={data.addons as any[]} outstandingTotal={data.totals}/></section></main>;
}
