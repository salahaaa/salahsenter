export const dynamic="force-dynamic";
import Link from "next/link";
import { Rocket } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { getStoreLaunchReadiness } from "@/lib/onboarding/store-launch-readiness";
import { StoreLaunchReadinessPanel } from "@/components/merchant/store-launch-readiness-panel";
export default async function StoreLaunchReadinessPage(){const session=await requireAuth();const store=await getMerchantPrimaryStore(session.userId);if(!store)return <main className="min-h-screen merchant-aurora"><SiteHeader/><section className="container py-10"><EmptyState title="لا يوجد متجر"/></section></main>;const initial=await getStoreLaunchReadiness(store.id);return <main className="min-h-screen merchant-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black text-blue-700"><Rocket className="h-4 w-4"/> Launch Gate</div><h1 className="text-3xl font-black text-slate-950">إطلاق المتجر للعامة</h1></div><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div><StoreLaunchReadinessPanel initial={JSON.parse(JSON.stringify(initial))}/></section></main>}
