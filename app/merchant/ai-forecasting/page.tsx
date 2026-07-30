"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle2, DollarSign, Package } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";

type Recommendation = {
  productId: string;
  productName: string;
  price: number;
  soldCount: number;
  viewCount: number;
  depletionDays: number;
  stockSeverity: "ok" | "warn" | "danger";
  stockAdvice: string;
  pricingAdvice: string;
};

type ForecastingData = {
  storeName: string;
  analyzedProductsCount: number;
  recommendations: Recommendation[];
  generatedAt: string;
};

export default function MerchantAiForecastingPage() {
  const [data, setData] = useState<ForecastingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/merchant/ai/forecasting")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <SiteHeader />
      <section className="container max-w-5xl py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-xs font-black text-purple-800">
              <Sparkles className="h-4 w-4 text-purple-600" /> الذكاء الاصطناعي التجاري (AI Advisor)
            </div>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">التنبؤ بنفاد المخزون واقتراح التسعير الذكي</h1>
            <p className="mt-2 text-sm text-slate-500">مراقبة سرعة البيع لكل منتج، التنبؤ بموعد نفاده، وتقديم توصيات أسعار مبتكرة لرفع الأرباح.</p>
          </div>
          <Button asChild variant="outline"><Link href="/merchant/inventory">إدارة المخزون</Link></Button>
        </div>

        {loading ? (
          <div className="rounded-3xl border bg-white p-12 text-center shadow-card font-bold text-slate-500">يتم تحليل سرعة المبيعات ومعدلات السحب عبر الذكاء الاصطناعي...</div>
        ) : data ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-white p-6 shadow-card">
              <div>
                <h2 className="text-xl font-black">{data.storeName} — تقرير الذكاء الاصطناعي</h2>
                <p className="mt-1 text-sm text-slate-500">تم فحص وتحليل {data.analyzedProductsCount} منتج نشط في متجرك</p>
              </div>
              <div className="rounded-2xl bg-purple-50 px-4 py-2 font-black text-purple-900 text-sm">
                تاريخ التنبؤ: {new Date(data.generatedAt).toLocaleString("ar")}
              </div>
            </div>

            <div className="grid gap-6">
              {data.recommendations.map((item) => (
                <article key={item.productId} className="rounded-3xl border bg-white p-6 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-900">{item.productName}</h3>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        السعر الحالي: {item.price.toLocaleString()} YER · المبيعات: {item.soldCount} · المشاهدات: {item.viewCount}
                      </p>
                    </div>
                    <div
                      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black ${
                        item.stockSeverity === "danger"
                          ? "bg-red-100 text-red-800"
                          : item.stockSeverity === "warn"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      <Package className="h-4 w-4" />
                      {item.stockSeverity === "danger" ? "خطر نفاد المخزون عاجلاً" : item.stockSeverity === "warn" ? "مخزون ينفد قريباً" : "المخزون آمن"}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-amber-50/70 p-4 border border-amber-200/60">
                      <h4 className="flex items-center gap-2 font-black text-amber-900">
                        <AlertTriangle className="h-5 w-5 text-amber-600" /> التنبؤ بالمخزون (Demand Forecast)
                      </h4>
                      <p className="mt-2 text-sm leading-7 text-slate-700 font-semibold">{item.stockAdvice}</p>
                    </div>

                    <div className="rounded-2xl bg-blue-50/70 p-4 border border-blue-200/60">
                      <h4 className="flex items-center gap-2 font-black text-blue-900">
                        <DollarSign className="h-5 w-5 text-blue-600" /> توصية التسعير الذكي (Pricing Advisor)
                      </h4>
                      <p className="mt-2 text-sm leading-7 text-slate-700 font-semibold">{item.pricingAdvice}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <Button asChild size="sm" variant="outline" className="rounded-xl font-bold">
                      <Link href={`/merchant/products/${item.productId}/edit`}>تعديل سعر المنتج</Link>
                    </Button>
                    <Button asChild size="sm" className="rounded-xl font-bold bg-slate-900 hover:bg-slate-800">
                      <Link href="/merchant/inventory">طلب إمداد مخزون</Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border bg-white p-8 text-center text-red-600 font-bold">تعذر تحميل بيانات التنبؤ الذكي.</div>
        )}
      </section>
      <Footer />
    </main>
  );
}
