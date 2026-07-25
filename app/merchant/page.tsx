export const dynamic = "force-dynamic";
export const revalidate = 0;

import { SiteHeader } from "@/components/layout/site-header";
import { MerchantDashboardPro } from "@/components/merchant/merchant-dashboard-pro";
import { requireAuth } from "@/lib/auth";
import { getMerchantDashboardData } from "@/lib/merchant-dashboard";

export default async function MerchantDashboardPage() {
  const session = await requireAuth();
  const data = await getMerchantDashboardData(session.userId);

  return (
    <main className="min-h-screen merchant-aurora">
      <SiteHeader />
      <section className="container py-8">
        <MerchantDashboardPro data={data} />
      </section>
    </main>
  );
}
