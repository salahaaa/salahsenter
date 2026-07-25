export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { desc } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { PlatformRevenueManagementPanel } from "@/components/admin/platform-revenue-management-panel";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";
import { db, stores } from "@/lib/db";
import { getAdminPlatformRevenue } from "@/lib/platform-revenue/service";

export default async function AdminPlatformRevenuePage() {
  const session = await requireAuth();
  await assertAdminOperation(session, "platform_revenue.statements.view");
  const [data, storeRows] = await Promise.all([
    getAdminPlatformRevenue(),
    db.select({ id: stores.id, name: stores.name, storeNumber: stores.storeNumber, merchantId: stores.merchantId }).from(stores).orderBy(desc(stores.createdAt)).limit(500)
  ]);
  return <main className="min-h-screen admin-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">إيرادات المنصة الموحدة</h1><p className="mt-2 max-w-4xl text-sm leading-7 text-slate-500">حدد لكل تاجر إيجاراً أو عمولة أو نموذجاً هجيناً، واتفاق الترويج منفصل. يظهر كل ذلك في كشف شهري واحد من دون لمس أي أموال تخص مبيعات العملاء.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/admin/rentals">تحصيل الإيجار القديم</Link></Button><Button asChild variant="outline"><Link href="/admin">العودة</Link></Button></div></div><PlatformRevenueManagementPanel stores={storeRows as any[]} terms={data.terms as any[]} promotionAgreements={data.promotionAgreements as any[]} statements={data.statements as any[]} reports={data.reports as any[]} outstanding={data.outstanding} /></section></main>;
}
