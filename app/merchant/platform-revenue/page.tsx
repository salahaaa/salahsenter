export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { PlatformRevenuePanel } from "@/components/merchant/platform-revenue-panel";
import { requireAuth } from "@/lib/auth";
import { getMerchantPlatformRevenue } from "@/lib/platform-revenue/service";

export default async function MerchantPlatformRevenuePage() {
  const session = await requireAuth();
  const data = await getMerchantPlatformRevenue(session.userId);
  return <main className="min-h-screen merchant-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700"><ReceiptText className="h-4 w-4" /> Platform Revenue</div><h1 className="text-3xl font-black text-slate-950">إيجار وعمولة وإعلانات المنصة</h1><p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">أرسل تقرير مبيعاتك الشهري وراجع كشف المنصة الموحد. لا تتدخل المنصة في الأموال التي تدفعها لك العملاء مقابل طلبات متجرك.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/merchant/ads">إعلانات المتجر</Link></Button><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div></div><PlatformRevenuePanel terms={data.terms as any[]} statements={data.statements as any[]} reports={data.reports as any[]} promotionAgreements={data.promotionAgreements as any[]} /></section></main>;
}
