"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Question = { id: string; question: string; isApproved: boolean; userName: string; createdAt: string; answers: Array<{ id: string; answer: string; userName: string }> };

export function ProductQuestionsPanel({ productId }: { productId: string }) {
  const [items, setItems] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const json = await fetch(`/api/merchant/products/${productId}/questions`, { cache: "no-store" }).then((response) => response.json()).catch(() => null);
    setItems(json?.data?.questions || []);
  }, [productId]);
  useEffect(() => { void load(); }, [load]);

  async function action(questionId: string, actionName: "approve" | "reject" | "answer") {
    setLoading(`${questionId}:${actionName}`);
    const response = await fetch(`/api/merchant/products/${productId}/questions`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId, action: actionName, answer: answers[questionId] || undefined }) });
    const json = await response.json().catch(() => ({}));
    setLoading(null);
    setMessage(response.ok ? json.data?.message || "تم تحديث السؤال" : json.message || "تعذر تحديث السؤال");
    if (response.ok) { setAnswers((current) => ({ ...current, [questionId]: "" })); await load(); }
  }

  return <section className="mt-8 rounded-3xl border bg-white p-6 shadow-card"><div className="mb-5"><h2 className="text-xl font-black">أسئلة العملاء وأجوبتها</h2><p className="mt-1 text-sm text-slate-500">اعتمد الأسئلة الواضحة وأجب عنها لتظهر في صفحة المنتج وتزيد ثقة العميل.</p></div>{message ? <p className="mb-4 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{message}</p> : null}{items.length ? <div className="space-y-4">{items.map((item) => <article key={item.id} className="rounded-2xl border bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-black text-slate-950">{item.question}</p><p className="mt-1 text-xs text-slate-500">من {item.userName}</p></div><Badge variant={item.isApproved ? "success" : "warning"}>{item.isApproved ? "ظاهر للعملاء" : "بانتظار الاعتماد"}</Badge></div>{item.answers.length ? <div className="mt-3 space-y-2">{item.answers.map((answer) => <div key={answer.id} className="rounded-xl bg-white p-3 text-sm"><b className="text-primary">رد {answer.userName}: </b>{answer.answer}</div>)}</div> : <div className="mt-4 space-y-2"><textarea value={answers[item.id] || ""} onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="اكتب ردًا مفيدًا وواضحًا للعميل" className="min-h-20 w-full rounded-xl border bg-white p-3 text-sm"/><div className="flex flex-wrap gap-2">{!item.isApproved ? <Button size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => action(item.id, "approve")}>اعتماد السؤال</Button> : null}<Button size="sm" disabled={Boolean(loading) || (answers[item.id] || "").trim().length < 3} onClick={() => action(item.id, "answer")}>نشر الرد</Button><Button size="sm" variant="destructive" disabled={Boolean(loading)} onClick={() => action(item.id, "reject")}>حذف السؤال</Button></div></div>}</article>)}</div> : <p className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">لا توجد أسئلة من العملاء لهذا المنتج حتى الآن.</p>}</section>;
}
