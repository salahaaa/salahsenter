export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { RentalBillingPanel } from "@/components/merchant/rental-billing-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { getMerchantRentalBilling } from "@/lib/rentals/service";

export default async function MerchantBillingPage() {
  const session = await requireAuth();
  const data = await getMerchantRentalBilling(session.userId);
  return <main className="min-h-screen merchant-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700"><ReceiptText className="h-4 w-4"/> Merchant Billing</div><h1 className="text-3xl font-black text-slate-950">إيجار المتجر والإضافات</h1><p className="mt-2 text-sm leading-7 text-slate-500">تابع اتفاق الإيجار وفواتير الاستحقاق والإضافات المفعلة لمتاجرك وفروعك.</p></div><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div><RentalBillingPanel agreements={data.agreements as any[]} invoices={data.invoices as any[]} addons={data.addons as any[]}/></section></main>;
}
