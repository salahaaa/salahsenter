"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Cable, CheckCircle2, ShieldCheck, ArrowRight, FileCode, Server } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

type SetupData = {
  store?: { id: string; name: string; storeNumber: string } | null;
  appSettings: any;
  sqlDownloadUrl: string;
  agentDownloadUrl: string;
  message: string;
};

export default function MerchantErpSetupPage() {
  const [data, setData] = useState<SetupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/integrations/erp/staging-installer")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  function downloadJson() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data.appSettings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `appsettings.${data.store?.storeNumber || "salahcenter"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <SiteHeader />
      <section className="container max-w-4xl py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">
              <Cable className="h-4 w-4" /> إعداد الوكيل المحاسبي المحلي (ERP Bridge)
            </div>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">حزمة الربط الجاهزة (Onyx Pro / الأمين / سماك)</h1>
            <p className="mt-2 text-sm text-slate-500">قم بتنزيل ملف الإعدادات الجاهز وسكربت الجداول الوسيطة لتثبيت الوكيل المحلي بضغطة زر.</p>
          </div>
          <Button asChild variant="outline"><Link href="/merchant/integrations">العودة للربط</Link></Button>
        </div>

        {loading ? (
          <div className="rounded-3xl border bg-white p-12 text-center shadow-card font-bold text-slate-500">يتم تجهيز حزمة الربط المخصصة لمتجرك...</div>
        ) : data ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border bg-white p-6 shadow-card">
              <div>
                <h2 className="text-xl font-black">{data.store?.name || "متجر التاجر"}</h2>
                <p className="mt-1 text-sm text-slate-500">رقم المتجر المربوط: {data.store?.storeNumber || "غير محدد"}</p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2 font-bold text-emerald-800 text-sm">
                <ShieldCheck className="h-5 w-5 text-emerald-600" /> إعدادات متوافقة مع C# .NET 8 Agent
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border bg-white p-6 shadow-card flex flex-col justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-black text-blue-900">
                    <FileCode className="h-5 w-5 text-blue-600" /> 1. سكربت الجداول المحاسبية (SQL Server)
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    سكربت SQL جاهز يقوم بإنشاء جدولي <code>SalahCenter_Staging_Orders</code> و <code>SalahCenter_Staging_Inventory</code> داخل قاعدة بياناتك (أونكس برو / الأمين).
                  </p>
                </div>
                <Button asChild className="mt-6 w-full rounded-2xl bg-blue-600 hover:bg-blue-700 font-black h-12">
                  <a href={data.sqlDownloadUrl} download>
                    <Download className="h-4 w-4 mr-2" /> تنزيل سكربت الـ SQL الجاهز
                  </a>
                </Button>
              </div>

              <div className="rounded-3xl border bg-white p-6 shadow-card flex flex-col justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-black text-purple-900">
                    <Server className="h-5 w-5 text-purple-600" /> 2. ملف إعدادات الوكيل (appsettings.json)
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    ملف إعدادات مخصص يحتوي على رابط المول ورقم متجرك. ضعه في مجلد برنامج <code>LocalSyncAgent</code> وأدخل المفتاح السري <code>SALAH_SYNC_API_KEY</code>.
                  </p>
                </div>
                <Button onClick={downloadJson} className="mt-6 w-full rounded-2xl bg-purple-600 hover:bg-purple-700 font-black h-12">
                  <Download className="h-4 w-4 mr-2" /> تنزيل ملف appsettings.json
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border bg-slate-900 p-6 text-white shadow-xl">
              <h3 className="text-lg font-black text-amber-400">خطوات التثبيت السريع للوكيل المحاسبي (Local Sync Agent):</h3>
              <ol className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
                <li><b>الخطوة 1:</b> نفذ سكربت <code>SQL Server</code> في قاعدة بيانات برنامج المحاسبة (Onyx Pro أو الأمين).</li>
                <li><b>الخطوة 2:</b> ضع ملف <code>appsettings.json</code> الذي نزلته في مجلد برنامج الوكيل <code>LocalSyncAgent</code>.</li>
                <li><b>الخطوة 3:</b> أدخل مفتاح الربط السري <code>SALAH_SYNC_API_KEY</code> الذي أعطاك إياه المسؤول العام.</li>
                <li><b>الخطوة 4:</b> شغل خدمة الويندوز <code>Restart-Service "SalahCenterSyncAgent"</code>؛ ستظهر حالة متجرك في المول باللون الأخضر 🟢 متصل ونشط!</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border bg-white p-8 text-center text-red-600 font-bold">تعذر تحميل بيانات الإعداد.</div>
        )}
      </section>
    </main>
  );
}
