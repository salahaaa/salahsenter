export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { ServerCog } from "lucide-react";
import { AutoScalingDashboard } from "@/components/admin/auto-scaling-dashboard";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { getAutoScalingSnapshot } from "@/lib/scaling/auto-scaling-intelligence";

export default async function AdminScalingPage() {
  const session = await requireAuth();
  await assertAdmin(session, "security.manage");
  const snapshot = await getAutoScalingSnapshot();
  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700"><ServerCog className="h-4 w-4" /> Scaling Control Plane</div>
            <h1 className="text-3xl font-black text-slate-950 md:text-5xl">Auto Scaling Intelligence</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">توسيع وتقليل موارد API وQueue Workers وRedis وLoad Balancing حسب الحمل، مع Emergency Scaling وPredictive AI وScaling Logs.</p>
          </div>
          <Button asChild variant="outline"><Link href="/admin">العودة</Link></Button>
        </div>
        <AutoScalingDashboard initialSnapshot={snapshot} />
      </section>
    </main>
  );
}
