export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import nextDynamic from "next/dynamic";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAuth } from "@/lib/auth";
import { buildMerchantAiInsights } from "@/lib/enterprise/merchant-ai";

const AiAssistantPanel = nextDynamic(() => import("@/components/merchant/ai-assistant-panel").then((module) => module.AiAssistantPanel), { loading: () => <div className="rounded-3xl border bg-white p-8 text-center text-sm font-bold text-slate-500">جارٍ تحميل أدوات الذكاء...</div> });

export default async function MerchantAiAssistantPage() {
  const session = await requireAuth();
  const data = await buildMerchantAiInsights(session.userId);
  return (
    <main className="min-h-screen merchant-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-6 flex items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">مساعد التاجر الذكي</h1><p className="mt-2 text-sm text-slate-500">تحليل وتوصيات على مستوى Enterprise للتاجر.</p></div><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div>
        {!data.store ? <EmptyState title="لا يوجد متجر مرتبط بحسابك" /> : <AiAssistantPanel initial={data as any} />}
      </section>
    </main>
  );
}
