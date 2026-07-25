export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { CreditCard, Gift, RefreshCcw, Wallet } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { getWalletDashboard } from "@/lib/enterprise/wallet";
import { formatCurrency, formatNumber } from "@/lib/utils";

export default async function WalletPage() {
  const session = await requireAuth();
  const data = await getWalletDashboard(session.userId);
  const wallet = data.wallet;
  const points = data.points;
  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4"><div><Badge className="mb-3 bg-blue-100 text-blue-700">Wallet & Loyalty</Badge><h1 className="text-4xl font-black text-slate-950">محفظتي ونقاط الولاء</h1><p className="mt-2 text-sm text-slate-500">رصيدك، المكافآت، الاستردادات، والحركات المالية داخل المول.</p></div><Button asChild variant="outline"><Link href="/">الرئيسية</Link></Button></div>
        <div className="grid gap-4 md:grid-cols-5">
          <Stat title="الرصيد الكلي" value={formatCurrency(wallet.balance, wallet.currency)} icon={<Wallet className="h-5 w-5" />} />
          <Stat title="المتاح" value={formatCurrency(wallet.availableBalance, wallet.currency)} icon={<CreditCard className="h-5 w-5" />} />
          <Stat title="المجمد" value={formatCurrency(wallet.frozenBalance, wallet.currency)} icon={<RefreshCcw className="h-5 w-5" />} />
          <Stat title="المسترد" value={formatCurrency(wallet.refundedBalance, wallet.currency)} icon={<RefreshCcw className="h-5 w-5" />} />
          <Stat title="النقاط" value={formatNumber(points?.pointsBalance || 0)} icon={<Gift className="h-5 w-5" />} />
        </div>
        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <Card><CardHeader><CardTitle>حركات المحفظة</CardTitle></CardHeader><CardContent className="space-y-3">{data.transactions.length ? data.transactions.map((tx) => <div key={tx.id} className="rounded-2xl border bg-white p-4"><div className="flex items-center justify-between"><p className="font-black">{tx.type}</p><Badge variant="outline">{tx.status}</Badge></div><p className="mt-1 text-sm text-slate-500">{tx.description || tx.referenceType || "عملية محفظة"}</p><p className="mt-2 font-black text-primary">{formatCurrency(tx.amount, tx.currency)}</p></div>) : <p className="text-sm font-bold text-slate-400">لا توجد حركات حالياً</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle>حركات النقاط</CardTitle></CardHeader><CardContent className="space-y-3">{data.rewards.length ? data.rewards.map((tx) => <div key={tx.id} className="rounded-2xl border bg-white p-4"><div className="flex items-center justify-between"><p className="font-black">{tx.type}</p><span className="font-black text-amber-600">{formatNumber(tx.points)} نقطة</span></div><p className="mt-1 text-sm text-slate-500">{tx.description || "عملية نقاط"}</p></div>) : <p className="text-sm font-bold text-slate-400">لا توجد نقاط بعد</p>}</CardContent></Card>
        </div>
      </section>
      <Footer />
    </main>
  );
}

function Stat({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) { return <Card><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between text-sm text-slate-500"><span>{title}</span><span className="text-blue-500">{icon}</span></CardTitle></CardHeader><CardContent><p className="text-2xl font-black text-slate-950">{value}</p></CardContent></Card>; }
