"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Bot, Copy, Lightbulb, Loader2, Send, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Recommendation = { type: string; title: string; description: string; severity: string; impactScore: number; actionUrl: string };
type InitialData = { recommendations: Recommendation[]; dashboard: { metrics: Record<string, number> }; customerInsights: { customers: number; averageOrder: number; repeatCustomers: number } | null };

export function AiAssistantPanel({ initial }: { initial: InitialData }) {
  const [question, setQuestion] = useState("كيف أزيد مبيعاتي؟");
  const [answer, setAnswer] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function ask(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/merchant/ai-assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "chat", question }) });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر التحليل");
    setAnswer(json.data.answer);
  }

  async function generateCopy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch("/api/merchant/ai-assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "product_copy", ...payload }) });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر توليد المحتوى");
    setCopyResult(json.data.copy);
  }

  async function saveRecommendations() {
    setLoading(true);
    const response = await fetch("/api/merchant/ai-assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "save_recommendations" }) });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? json.data.message : json.message || "تعذر الحفظ");
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border bg-slate-950 p-8 text-white shadow-soft">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(245,158,11,.22),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(59,130,246,.22),transparent_30%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <Badge className="mb-4 bg-white/10 text-white">AI Merchant Assistant</Badge>
            <h1 className="text-4xl font-black md:text-6xl">مساعد التاجر الذكي</h1>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-white/70">تحليل مبيعات، طلبات، عملاء، مخزون، أرباح تقديرية ومنتجات مع توصيات قابلة للتنفيذ.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <HeroMetric label="العملاء" value={initial.customerInsights?.customers || 0} />
            <HeroMetric label="متوسط الطلب" value={Math.round(initial.customerInsights?.averageOrder || 0)} />
            <HeroMetric label="التوصيات" value={initial.recommendations.length} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-blue-600" /> اسأل عن أداء متجرك</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={ask} className="space-y-4">
              <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} className="min-h-28" placeholder="مثال: كيف أزيد مبيعاتي؟" />
              <Button disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} تحليل وإجابة</Button>
            </form>
            {answer ? <pre className="mt-5 whitespace-pre-wrap rounded-3xl bg-slate-50 p-5 text-sm leading-8 text-slate-700">{answer}</pre> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-500" /> توصيات فعلية</CardTitle><Button size="sm" variant="outline" onClick={saveRecommendations}>حفظ</Button></CardHeader>
          <CardContent className="space-y-3">
            {initial.recommendations.map((rec) => <Link key={rec.title} href={rec.actionUrl} className="block rounded-2xl border bg-slate-50 p-4 transition hover:bg-blue-50"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{rec.title}</p><p className="mt-1 text-xs leading-6 text-slate-500">{rec.description}</p></div><Badge variant={rec.severity === "danger" ? "danger" : rec.severity === "warning" ? "warning" : "success"}>{rec.impactScore}</Badge></div></Link>)}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-violet-600" /> AI Product Assistant</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={generateCopy} className="grid gap-4 md:grid-cols-2">
            <Field label="اسم المنتج الأساسي" name="baseName" required />
            <Field label="التصنيف" name="category" />
            <Field label="الجمهور المستهدف" name="audience" />
            <Field label="نبرة الكتابة" name="tone" placeholder="فخم / شبابي / تقني" />
            <div className="space-y-2 md:col-span-2"><Label>المميزات</Label><Textarea name="features" placeholder="خفيف، جلد طبيعي، ضمان سنة" /></div>
            <Button className="md:col-span-2" disabled={loading}><Sparkles className="h-4 w-4" /> توليد محتوى المنتج</Button>
          </form>
          {copyResult ? <div className="mt-6 grid gap-3 md:grid-cols-2">{Object.entries(copyResult).map(([key, value]) => <div key={key} className="rounded-2xl border bg-slate-50 p-4"><p className="mb-2 flex items-center gap-2 font-black text-slate-950"><Copy className="h-4 w-4" /> {key}</p><p className="text-sm leading-7 text-slate-600">{Array.isArray(value) ? value.join("، ") : String(value)}</p></div>)}</div> : null}
        </CardContent>
      </Card>
      {message ? <p className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-700">{message}</p> : null}
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: number }) { return <div className="rounded-3xl bg-white/10 p-4 text-center"><p className="text-3xl font-black">{value.toLocaleString("ar")}</p><p className="mt-1 text-xs text-white/60">{label}</p></div>; }
function Field({ label, name, required = false, placeholder }: { label: string; name: string; required?: boolean; placeholder?: string }) { return <div className="space-y-2"><Label>{label}</Label><Input name={name} required={required} placeholder={placeholder} /></div>; }
