export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { AdInvoiceManagementPanel } from "@/components/admin/ad-invoice-management-panel";
import { IssueAdInvoicesButton } from "@/components/admin/issue-ad-invoices-button";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";
import { adInvoices, db, stores, users } from "@/lib/db";

export default async function AdminAdsBillingPage() {
  const session = await requireAuth();
  await assertAdminOperation(session, "ads.billing.view");
  const invoices = await db
    .select({ invoice: adInvoices, storeName: stores.name, storeNumber: stores.storeNumber, merchantName: users.fullName, merchantEmail: users.email })
    .from(adInvoices)
    .innerJoin(stores, eq(adInvoices.storeId, stores.id))
    .innerJoin(users, eq(adInvoices.merchantId, users.id))
    .orderBy(desc(adInvoices.createdAt))
    .limit(300);
  return <main className="min-h-screen admin-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">دفتر وفواتير الإعلانات</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">رسوم CPC/CPM الصادرة من دفتر الأحداث. الحجز هنا تشغيلي للميزانية وليس تحصيلاً مالياً تلقائياً.</p></div><div className="flex gap-2"><IssueAdInvoicesButton /><Button asChild variant="outline"><Link href="/admin/ads-platform">منصة الإعلانات</Link></Button><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div></div><AdInvoiceManagementPanel invoices={invoices as any[]} /></section></main>;
}
