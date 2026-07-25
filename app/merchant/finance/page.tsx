export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { Landmark, ReceiptText, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { customerMoneyMode } from "@/lib/platform-revenue/customer-money-policy";

export default async function MerchantFinancePage() {
  const session = await requireAuth();
  const store = await getMerchantPrimaryStore(session.userId);
  if (!store) return <main className="min-h-screen merchant-aurora"><SiteHeader /><section className="container py-12"><EmptyState title="لا يوجد متجر" /></section></main>;
  const directCollection = customerMoneyMode() === "merchant_collects";
  return <main className="min-h-screen merchant-aurora"><SiteHeader /><section className="container py-8"><div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-black">مالية المتجر</h1><p className="mt-2 text-sm text-slate-500">إدارة وسائل الدفع الخاصة بمتجرك وسجل الطلبات، مع فصلها عن إيرادات المنصة.</p></div><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div>{directCollection ? <section className="rounded-[2rem] border bg-white p-8 shadow-card"><div className="grid gap-5 md:grid-cols-[auto_1fr]"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-7 w-7" /></div><div><h2 className="text-2xl font-black text-slate-950">العميل يدفع لك مباشرة</h2><p className="mt-3 max-w-3xl text-sm leading-8 text-slate-600">صلاح سنتر لا يحتفظ بمبيعات العملاء ولا ينشئ رصيداً قابلاً للسحب للتاجر في نموذج الإطلاق الحالي. اربط حسابك البنكي أو محفظتك في وسائل دفع متجرك، وتستلم المبلغ مباشرة من العميل أو عند التسليم.</p><div className="mt-5 flex flex-wrap gap-3"><Button asChild><Link href="/merchant/operations-settings"><Landmark className="h-4 w-4" /> وسائل الدفع والتشغيل</Link></Button><Button asChild variant="outline"><Link href="/merchant/platform-revenue"><ReceiptText className="h-4 w-4" /> إيجار وعمولة وإعلانات المنصة</Link></Button></div></div></div></section> : <section className="rounded-3xl border bg-white p-6 shadow-card"><p className="font-black">وضع تسوية المنصة مفعل بإدارة النظام.</p></section>}</section></main>;
}
