"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/utils";

type Account = { availableBalance: string; pendingBalance: string; lifetimeEarnings: string; lifetimePayouts: string; currency: string };
type Ledger = { id: string; type: string; direction: string; amount: string; currency: string; description: string | null; createdAt: string | Date };
type Payout = { id: string; amount: string; currency: string; status: string; method: string; createdAt: string | Date };

export function MerchantFinancePanel({ account, ledger, payouts }: { account: Account; ledger: Ledger[]; payouts: Payout[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  async function requestPayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const response = await fetch("/api/merchant/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(f.get("amount") || 0), method: f.get("method") || "bank_transfer", destination: { accountName: f.get("accountName"), accountNumber: f.get("accountNumber"), bankName: f.get("bankName"), walletNumber: f.get("walletNumber") }, note: f.get("note") || undefined }) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم إرسال طلب السحب" : json.message || "تعذر طلب السحب");
    if (response.ok) { event.currentTarget.reset(); router.refresh(); }
  }
  return <div className="space-y-8"><section className="grid gap-4 md:grid-cols-4"><Metric title="الرصيد المتاح" value={formatCurrency(account.availableBalance, account.currency)} /><Metric title="قيد المعالجة" value={formatCurrency(account.pendingBalance, account.currency)} /><Metric title="إجمالي المبيعات" value={formatCurrency(account.lifetimeEarnings, account.currency)} /><Metric title="إجمالي المسحوبات" value={formatCurrency(account.lifetimePayouts, account.currency)} /></section><section className="rounded-3xl border bg-white p-6 shadow-card"><h2 className="mb-4 text-xl font-black">طلب سحب مستحقات</h2><form onSubmit={requestPayout} className="grid gap-3 md:grid-cols-3"><input name="amount" type="number" className="h-11 rounded-xl border px-3" placeholder="المبلغ" required/><select name="method" className="h-11 rounded-xl border px-3"><option value="bank_transfer">تحويل بنكي</option><option value="wallet">محفظة</option><option value="remittance">حوالة</option><option value="cash">نقدي</option></select><input name="bankName" className="h-11 rounded-xl border px-3" placeholder="البنك/المحفظة"/><input name="accountName" className="h-11 rounded-xl border px-3" placeholder="اسم المستفيد"/><input name="accountNumber" className="h-11 rounded-xl border px-3" placeholder="رقم الحساب"/><input name="walletNumber" className="h-11 rounded-xl border px-3" placeholder="رقم المحفظة"/><input name="note" className="h-11 rounded-xl border px-3 md:col-span-2" placeholder="ملاحظة"/><Button>إرسال طلب السحب</Button></form>{message?<p className="mt-3 text-sm font-bold text-slate-600">{message}</p>:null}</section><section className="grid gap-8 xl:grid-cols-2"><Table title="آخر الحركات المالية" rows={ledger.map((row)=>[row.type, row.direction, formatCurrency(row.amount,row.currency), new Intl.DateTimeFormat('ar').format(new Date(row.createdAt))])}/><Table title="طلبات السحب" rows={payouts.map((row)=>[row.status, row.method, formatCurrency(row.amount,row.currency), new Intl.DateTimeFormat('ar').format(new Date(row.createdAt))])}/></section></div>;
}
function Metric({title,value}:{title:string;value:string}){return <div className="rounded-3xl border bg-white p-5 shadow-card"><p className="text-sm font-bold text-slate-500">{title}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></div>}
function Table({title,rows}:{title:string;rows:string[][]}){return <div className="rounded-3xl border bg-white p-5 shadow-card"><h2 className="mb-4 text-xl font-black">{title}</h2>{!rows.length?<p className="text-sm text-slate-400">لا توجد بيانات</p>:<div className="space-y-2">{rows.map((row,i)=><div key={i} className="grid grid-cols-4 gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600">{row.map((cell,j)=><span key={j}>{cell}</span>)}</div>)}</div>}</div>}
