import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

type Variant = { campaignId: string; campaignName: string; variantId: string; label: string; headline: string | null; impressions: number; clicks: number; conversions: number; revenue: number; ctr: number; cvr: number };

/** Read-only performance view; campaign edits remain an explicit new review cycle. */
export function AdCreativeExperimentPanel({ variants }: { variants: Variant[] }) {
  if (!variants.length) return null;
  return <section className="mt-8 rounded-3xl border bg-white p-6 shadow-card"><div className="mb-4"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black text-slate-950">Cohort وA/B Creative</h2><Badge variant="outline">آخر 7 أيام</Badge></div><p className="mt-1 text-xs font-bold leading-6 text-slate-500">التقسيم ثابت لكل متصفح داخل التخزين المحلي، ويظهر هنا أداء النسخ التي سجلت أحداثاً. لا يوجد اختيار فائز تلقائي أو تغيير لحملة معتمدة دون مراجعة جديدة.</p></div><div className="grid gap-3 lg:grid-cols-2">{variants.map((variant) => <article key={`${variant.campaignId}:${variant.variantId}`} className="rounded-2xl border bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-950">{variant.campaignName} · نسخة {variant.label}</h3><p className="mt-1 text-xs text-slate-500">{variant.headline || "بدون عنوان"}</p></div><Badge variant="outline">CTR {variant.ctr}%</Badge></div><div className="mt-3 grid grid-cols-4 gap-2 text-xs"><Metric label="ظهور" value={variant.impressions} /><Metric label="نقرات" value={variant.clicks} /><Metric label="CVR" value={`${variant.cvr}%`} /><Metric label="إيراد" value={formatCurrency(variant.revenue)} /></div></article>)}</div></section>;
}
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl bg-white p-3"><span className="text-slate-500">{label}</span><b className="mt-1 block text-slate-950">{value}</b></div>; }
