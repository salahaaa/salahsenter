export const dynamic = "force-dynamic";

import Link from "next/link";
import { asc } from "drizzle-orm";
import { CreditCard } from "lucide-react";
import { FinancialProviderManagementPanel } from "@/components/admin/financial-provider-management-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { db, financialProviders } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";

export default async function AdminFinancialProvidersPage() {
  const session = await requireAuth();
  await assertAdminOperation(session, "providers.view");
  const providers = await db.select().from(financialProviders).orderBy(asc(financialProviders.sortOrder), asc(financialProviders.name));
  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700"><CreditCard className="h-4 w-4" /> Central Financial Governance</div>
            <h1 className="text-3xl font-black text-slate-950 md:text-5xl">سجل مزودي الخدمات المالية</h1>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-500">تحكم مركزي بالبنوك والمحافظ وبوابات الدفع والحوالات والدفع عند الاستلام قبل السماح للتجار باستخدامها.</p>
          </div>
          <Button asChild variant="outline"><Link href="/admin">العودة</Link></Button>
        </div>
        <FinancialProviderManagementPanel initialProviders={JSON.parse(JSON.stringify(providers))} />
      </section>
    </main>
  );
}
