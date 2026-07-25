"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, ClipboardCheck, Lightbulb, Loader2, ShieldCheck, TriangleAlert, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type RepairableDraft = {
  sourceRow?: number;
  name?: string;
  barcode?: string;
  basePrice?: number;
  stockQuantity?: number;
  description?: string;
  variants?: Array<{ sku?: string }>;
};

type Repair = {
  sourceRow: number | string;
  valid: boolean;
  issues: string[];
  fixes: Record<string, unknown>;
  suggestedCategoryQuery: string;
};

type RepairPlan = {
  repairs: Repair[];
  summary: { rows: number; valid: number; invalid: number };
  message: string;
};

/** Review-only UI: it requests suggestions for the current import preview but never mutates drafts or saves data. */
export function AiImportRepairPanel({ drafts }: { drafts: RepairableDraft[] }) {
  const [plan, setPlan] = useState<RepairPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const rows = useMemo(() => drafts.slice(0, 1000).map((draft, index) => ({
    sourceRow: draft.sourceRow || index + 1,
    name: draft.name,
    sku: draft.variants?.[0]?.sku,
    barcode: draft.barcode,
    basePrice: draft.basePrice,
    stockQuantity: draft.stockQuantity,
    description: draft.description
  })), [drafts]);

  useEffect(() => {
    setPlan(null);
    setMessage(null);
  }, [drafts]);

  async function analyze() {
    if (!rows.length) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/ai/merchant/import-repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(json.message || "تعذر بناء خطة الإصلاح");
        return;
      }
      setPlan(json.data);
      setMessage(json.data?.message || "تم تجهيز خطة المراجعة");
    } catch {
      setMessage("تعذر الاتصال بخدمة المراجعة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-violet-200 bg-violet-50/50 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-violet-100 bg-white/80 p-5">
        <div className="text-right">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-800"><WandSparkles className="h-4 w-4" /> AI Import Repair</div>
          <h3 className="text-lg font-black text-slate-950">خطة إصلاح قبل الحفظ</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">افحص المسودات الحالية واقرأ النواقص وSKU والمرجع الداخلي والخيارات المقترحة. هذه مراجعة فقط: لن تُحفظ المنتجات أو تتغير الأسعار أو المخزون تلقائياً.</p>
        </div>
        <Button type="button" onClick={analyze} disabled={loading || !rows.length} className="bg-violet-700 hover:bg-violet-800">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
          {loading ? "جارٍ فحص المسودات..." : `فحص ${rows.length} صف للمراجعة`}
        </Button>
      </div>

      <div className="p-5">
        <div className="rounded-2xl border border-violet-200 bg-white p-4 text-xs font-bold leading-6 text-violet-950"><ShieldCheck className="ml-1 inline h-4 w-4 text-violet-700" /> الحد الأقصى للخطة 1000 صف. لا يُنشئ هذا الزر منتجات ولا ينشرها. الباركود المقترح هو مرجع داخلي فقط وليس GS1/EAN.</div>
        {message ? <p className={`mt-3 text-sm font-bold ${plan ? "text-emerald-700" : "text-red-700"}`}>{message}</p> : null}
        {plan ? <RepairResults plan={plan} /> : null}
      </div>
    </section>
  );
}

function RepairResults({ plan }: { plan: RepairPlan }) {
  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="صفوف محللة" value={plan.summary.rows} tone="slate" />
        <Metric label="جاهزة مبدئياً" value={plan.summary.valid} tone="emerald" />
        <Metric label="تحتاج إدخالاً بشرياً" value={plan.summary.invalid} tone="amber" />
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[920px] text-right text-sm">
          <thead className="bg-slate-100 text-slate-700"><tr><th className="p-3">الصف</th><th className="p-3">الحالة</th><th className="p-3">ما يحتاج مراجعة</th><th className="p-3">اقتراحات آمنة للمراجعة</th><th className="p-3">بحث التصنيف</th></tr></thead>
          <tbody>{plan.repairs.slice(0, 100).map((repair) => <tr key={String(repair.sourceRow)} className="border-t align-top"><td className="p-3 font-black">{repair.sourceRow}</td><td className="p-3">{repair.valid ? <span className="inline-flex items-center gap-1 text-emerald-700"><BadgeCheck className="h-4 w-4" /> جاهز مبدئياً</span> : <span className="inline-flex items-center gap-1 text-amber-700"><TriangleAlert className="h-4 w-4" /> يحتاج إدخالاً</span>}</td><td className="p-3 text-slate-600">{repair.issues.length ? <ul className="space-y-1">{repair.issues.map((issue) => <li key={issue}>• {issue}</li>)}</ul> : "لا توجد مشكلة إلزامية مكتشفة"}</td><td className="p-3"><FixList fixes={repair.fixes} /></td><td className="p-3 text-slate-600">{repair.suggestedCategoryQuery || "—"}</td></tr>)}</tbody>
        </table>
      </div>
      {plan.repairs.length > 100 ? <p className="text-xs font-bold text-slate-500">تم عرض أول 100 صف فقط لتبقى الواجهة سريعة؛ يظل الملخص مبنياً على كل {plan.repairs.length} صفاً.</p> : null}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><Lightbulb className="ml-1 inline h-4 w-4" /> راجع النواقص وعدّل ملف المصدر أو المسودات يدوياً قبل الحفظ. الاقتراحات لا تطبق تلقائياً ولا تُعد دليلاً على السعر أو المخزون أو مطابقة GS1.</div>
    </div>
  );
}

function FixList({ fixes }: { fixes: Record<string, unknown> }) {
  const variants = Array.isArray(fixes.variants) ? fixes.variants : [];
  const values = [
    typeof fixes.sku === "string" ? `SKU داخلي مقترح: ${fixes.sku}` : null,
    typeof fixes.internalBarcode === "string" ? `مرجع باركود داخلي (ليس GS1/EAN): ${fixes.internalBarcode}` : null,
    variants.length ? `خيارات مقترحة: ${variants.map((variant) => typeof variant === "object" && variant && "title" in variant ? String(variant.title) : "").filter(Boolean).join("، ")}` : null
  ].filter(Boolean);
  return values.length ? <ul className="space-y-1 text-slate-600">{values.map((value) => <li key={value}>• {value}</li>)}</ul> : <span className="text-slate-400">لا يوجد اقتراح إضافي</span>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "slate" | "emerald" | "amber" }) {
  const styles = { slate: "border-slate-200 bg-slate-50 text-slate-800", emerald: "border-emerald-200 bg-emerald-50 text-emerald-800", amber: "border-amber-200 bg-amber-50 text-amber-900" };
  return <div className={`rounded-2xl border p-4 text-right ${styles[tone]}`}><p className="text-xs font-bold opacity-70">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}
