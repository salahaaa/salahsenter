"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Quality = { score: number; ready: boolean; checks: Array<{ key: string; label: string; score: number; max: number; ok: boolean; hint: string }> };
export function CatalogQualityCard({ productId }: { productId: string }) {
  const [quality, setQuality] = useState<Quality | null>(null);
  useEffect(() => { let active = true; fetch(`/api/merchant/products/${productId}/quality`, { cache: "no-store" }).then((response) => response.json()).then((json) => { if (active) setQuality(json.data?.quality || null); }).catch(() => undefined); return () => { active = false; }; }, [productId]);
  if (!quality) return <section className="rounded-3xl border bg-white p-5 shadow-card"><div className="flex items-center gap-2 text-sm font-bold text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/> جارٍ احتساب جودة الكتالوج...</div></section>;
  return <section className="rounded-3xl border bg-white p-5 shadow-card"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">جودة الكتالوج</h2><p className="mt-1 text-sm text-slate-500">فحص قابل للتفسير قبل النشر أو إرسال المنتج للمراجعة.</p></div><Badge variant={quality.ready ? "success" : "warning"}>{quality.score}%</Badge></div><div className="mt-4 grid gap-2 md:grid-cols-2">{quality.checks.map((check) => <div key={check.key} className={`rounded-2xl p-3 text-sm ${check.ok ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}><div className="flex items-center justify-between"><span className="font-black">{check.ok ? <CheckCircle2 className="inline h-4 w-4"/> : <CircleAlert className="inline h-4 w-4"/>} {check.label}</span><span>{check.score}/{check.max}</span></div>{!check.ok ? <p className="mt-1 text-xs leading-5">{check.hint}</p> : null}</div>)}</div></section>;
}
