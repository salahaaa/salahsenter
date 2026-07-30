"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, Gift, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

type LoyaltyData = {
  fullName: string;
  points: number;
  totalSpent: number;
  totalOrders: number;
  tier: string;
  tierLabel: string;
  nextTierPoints: number;
  availableCoupons: Array<{ code: string; title: string; minPoints: number; discountValue: string }>;
};

export function LoyaltyPortalPanel() {
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/loyalty/balance")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="container max-w-5xl py-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
            <Award className="h-4 w-4 text-amber-600" /> برنامج ولاء صلاح سنتر (Salah Center Rewards)
          </div>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">نقاط ومكافآت المول التجاري الموحدة</h1>
          <p className="mt-2 text-sm text-slate-500">اكتسب النقاط من أي متجر في المول واستبدلها كقسائم خصم في جميع الأجنحة التجارية.</p>
        </div>
        <Button asChild variant="outline"><Link href="/">الرئيسية</Link></Button>
      </div>

      {loading ? (
        <div className="rounded-3xl border bg-white p-12 text-center shadow-card font-bold text-slate-500">يتم حساب رصيد الولاء ومستوى مكافآتك...</div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold opacity-90">رصيد نقاطك الحالي</span>
                <Sparkles className="h-6 w-6 text-amber-200" />
              </div>
              <div className="mt-4 text-4xl font-black tracking-tight">{data.points.toLocaleString()} نقطة</div>
              <p className="mt-2 text-xs opacity-80">نقطة 1 لكل 1,000 ريال مبيعات + 100 نقطة ترحيبية</p>
            </div>

            <div className="rounded-3xl border bg-white p-6 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-500">مستوى الولاء</span>
                <Award className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="mt-4 text-3xl font-black text-indigo-950">{data.tierLabel}</div>
              <p className="mt-2 text-xs text-slate-500">
                {data.nextTierPoints > 0 ? `تبقى ${data.nextTierPoints} نقطة للترقية للمستوى التالي` : "أنت في المستوى الأعلى (VIP)!"}
              </p>
            </div>

            <div className="rounded-3xl border bg-white p-6 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-500">إجمالي مشترياتك في المول</span>
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="mt-4 text-3xl font-black text-slate-950">{data.totalSpent.toLocaleString()} ريال</div>
              <p className="mt-2 text-xs text-slate-500">عبر {data.totalOrders} طلب شراء مكتمل</p>
            </div>
          </div>

          <section className="rounded-3xl border bg-white p-6 shadow-card">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Gift className="h-5 w-5 text-amber-500" /> قسائم الخصم المتاحة للاستبدال الفوري
            </h2>
            <p className="mt-1 text-sm text-slate-500">استخدم هذه الأكواد عند إتمام الطلب من أي متجر في المول لتطبيق الخصم الفوري:</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {data.availableCoupons.map((coupon) => {
                const canRedeem = data.points >= coupon.minPoints;
                return (
                  <div
                    key={coupon.code}
                    className={`rounded-2xl border p-5 transition ${canRedeem ? "border-amber-300 bg-amber-50/60" : "border-slate-200 bg-slate-50 opacity-60"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-base font-black text-slate-900">{coupon.code}</span>
                      <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-amber-400">{coupon.discountValue}</span>
                    </div>
                    <p className="mt-3 font-bold text-slate-800">{coupon.title}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">يتطلب: {coupon.minPoints} نقطة ولاء</p>
                    <Button
                      asChild
                      disabled={!canRedeem}
                      className="mt-4 w-full rounded-xl bg-slate-900 font-black text-white hover:bg-slate-800"
                    >
                      <Link href={`/cart?coupon=${coupon.code}`}>
                        {canRedeem ? "استخدام القسيمة في السلة" : "النقاط غير كافية"}
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-3xl border bg-white p-8 text-center text-red-600 font-bold">
          يجب تسجيل الدخول لعرض نقاط صلاح سنتر. <Link className="underline font-black" href="/login?next=%2Floyalty">دخول الآن</Link>
        </div>
      )}
    </section>
  );
}
