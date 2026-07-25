export const dynamic = "force-dynamic";

import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { SensitiveControlPanel } from "@/components/admin/sensitive-control-panel";
import { requireAuth } from "@/lib/auth";
import { assertEligibleSensitiveAdmin } from "@/lib/sensitive-control";

export default async function SensitiveControlPage() {
  const session = await requireAuth();
  await assertEligibleSensitiveAdmin(session.userId);
  return <main className="min-h-screen admin-aurora"><SiteHeader/><section className="container py-8"><div className="mb-6 flex justify-end"><Button asChild variant="outline"><Link href="/admin">العودة للوحة الأدمن</Link></Button></div><SensitiveControlPanel/></section></main>;
}
