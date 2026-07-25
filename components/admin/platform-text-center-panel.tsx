"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, History, Languages, Loader2, RefreshCcw, Save, Search, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Version = { id: string; value: string; status: string; versionNumber: number; changeNote: string | null; createdAt: string; publishedAt: string | null };
type TextRow = {
  entry: { id: string; textKey: string; namespace: string; audience: string; description: string; isEditable: boolean };
  published: Version | null;
  draft: Version | null;
  history: Version[];
  definition?: { defaultValue: string };
};

export function PlatformTextCenterPanel() {
  const [rows, setRows] = useState<TextRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [namespace, setNamespace] = useState("all");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load(preferredKey?: string | null) {
    setLoading(true);
    const response = await fetch("/api/admin/text-center?locale=ar", { cache: "no-store" });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setMessage(json.message || "تعذر تحميل مركز النصوص");
      return;
    }
    const nextRows = json.data?.entries || [];
    setRows(nextRows);
    const nextKey = preferredKey && nextRows.some((row: TextRow) => row.entry.textKey === preferredKey) ? preferredKey : selectedKey && nextRows.some((row: TextRow) => row.entry.textKey === selectedKey) ? selectedKey : nextRows[0]?.entry.textKey || null;
    setSelectedKey(nextKey);
  }

  // Initial catalogue fetch only; changing a selected row must not re-fetch the entire manager.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);

  const namespaces = useMemo(() => ["all", ...Array.from(new Set(rows.map((row) => row.entry.namespace)))], [rows]);
  const filtered = useMemo(() => rows.filter((row) => (namespace === "all" || row.entry.namespace === namespace) && (!query.trim() || [row.entry.textKey, row.entry.description, row.entry.namespace].join(" ").toLowerCase().includes(query.trim().toLowerCase()))), [namespace, query, rows]);
  const selected = rows.find((row) => row.entry.textKey === selectedKey) || filtered[0] || null;

  useEffect(() => {
    if (!selected) return;
    setValue(selected.draft?.value ?? selected.published?.value ?? selected.definition?.defaultValue ?? "");
    setNote(selected.draft?.changeNote || "");
  }, [selected]);

  async function action(payload: Record<string, unknown>, preferredKey: string | null | undefined = selected?.entry.textKey) {
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/admin/text-center", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json().catch(() => ({}));
    setSaving(false);
    setMessage(json.data?.message || json.message || (response.ok ? "تمت العملية" : "تعذر تنفيذ العملية"));
    if (response.ok) await load(preferredKey);
  }

  if (loading) return <div className="grid min-h-64 place-items-center rounded-3xl border bg-white"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;

  if (!rows.length) {
    return <section className="rounded-3xl border bg-white p-8 text-center shadow-card"><Languages className="mx-auto h-12 w-12 text-primary" /><h2 className="mt-4 text-2xl font-black">مركز النصوص يحتاج مزامنة أولى</h2><p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-slate-500">تُنشئ المزامنة مفاتيح النصوص الافتراضية كنسخ منشورة مطابقة للنص الحالي؛ لا تغيّر ما يراه الزوار.</p><Button className="mt-6" disabled={saving} onClick={() => action({ action: "sync", locale: "ar" }, null)}>{saving ? "جارٍ تجهيز الكتالوج..." : <><RefreshCcw className="h-4 w-4" /> مزامنة كتالوج النصوص</>}</Button>{message ? <p className="mt-4 text-sm font-bold text-slate-600">{message}</p> : null}</section>;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border bg-white p-5 shadow-card">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700"><Languages className="h-3.5 w-3.5" /> العربية · جاهز لإضافة لغات</div><h2 className="mt-3 text-2xl font-black text-slate-950">نصوص المتسوق الثابتة</h2><p className="mt-1 max-w-3xl text-sm leading-7 text-slate-500">احفظ مسودة، راجع المعاينة، ثم انشر مباشرة مع سجل تدقيق ونسخ قابلة للاسترجاع. النصوص التي لديها مدير محتوى متخصص لا تظهر هنا حتى لا يتكرر مصدر الحقيقة.</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={saving} onClick={() => action({ action: "sync", locale: "ar" }, selected?.entry.textKey)}><RefreshCcw className="h-4 w-4" /> مزامنة مفاتيح جديدة</Button></div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="rounded-3xl border bg-white p-4 shadow-card">
          <div className="relative"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pr-10" placeholder="ابحث في المفتاح أو الوصف" /></div>
          <div className="mt-3 flex flex-wrap gap-2">{namespaces.map((item) => <button key={item} type="button" onClick={() => setNamespace(item)} className={`rounded-full px-3 py-1.5 text-xs font-black transition ${namespace === item ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{item === "all" ? "كل المجالات" : item}</button>)}</div>
          <div className="mt-4 max-h-[610px] space-y-2 overflow-y-auto pr-1">{filtered.map((row) => <button key={row.entry.id} type="button" onClick={() => setSelectedKey(row.entry.textKey)} className={`w-full rounded-2xl border p-3 text-right transition ${selected?.entry.textKey === row.entry.textKey ? "border-violet-300 bg-violet-50" : "border-transparent bg-slate-50 hover:border-slate-200 hover:bg-white"}`}><div className="flex items-start justify-between gap-3"><span className="line-clamp-1 font-black text-slate-900">{row.entry.description}</span><StatusDot row={row} /></div><p className="mt-1 truncate text-[11px] font-bold text-slate-400">{row.entry.textKey}</p></button>)}</div>
        </aside>

        {selected ? <section className="rounded-3xl border bg-white p-5 shadow-card md:p-6">
          <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-start md:justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-violet-600">{selected.entry.namespace} · {selected.entry.audience}</p><h3 className="mt-1 text-xl font-black text-slate-950">{selected.entry.description}</h3><p className="mt-1 font-mono text-xs text-slate-400">{selected.entry.textKey}</p></div><StatusDot row={selected} detailed /></div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
            <div className="space-y-4"><div className="space-y-2"><Label htmlFor="text-value">نص المسودة العربية</Label><Textarea id="text-value" value={value} onChange={(event) => setValue(event.target.value)} className="min-h-44 text-base leading-8" /></div><div className="space-y-2"><Label htmlFor="text-note">ملاحظة التعديل (تظهر في سجل التدقيق)</Label><Input id="text-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="مثال: تعديل رسالة حملة رمضان" /></div><div className="flex flex-wrap gap-2"><Button disabled={saving} onClick={() => action({ action: "save_draft", key: selected.entry.textKey, locale: "ar", value, note })}>{saving ? "جارٍ الحفظ..." : <><Save className="h-4 w-4" /> حفظ المسودة</>}</Button><Button variant="secondary" disabled={saving || !selected.draft} onClick={() => action({ action: "publish", key: selected.entry.textKey, locale: "ar" })}><Send className="h-4 w-4" /> نشر المسودة</Button></div></div>
            <PreviewCard row={selected} value={value} />
          </div>
          <div className="mt-6 border-t pt-5"><div className="mb-3 flex items-center gap-2"><History className="h-4 w-4 text-slate-500" /><h4 className="font-black text-slate-900">سجل النسخ والاسترجاع</h4></div><div className="space-y-2">{selected.history.slice(0, 8).map((version) => <div key={version.id} className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-3 md:flex-row md:items-center md:justify-between"><div><span className="rounded-full bg-white px-2 py-1 text-xs font-black text-slate-600">نسخة {version.versionNumber}</span><span className="mr-2 text-xs font-bold text-slate-500">{version.status === "published" ? "منشورة" : version.status === "draft" ? "مسودة" : "مؤرشفة"}</span><p className="mt-2 line-clamp-1 text-sm text-slate-700">{version.value || "(نص فارغ)"}</p>{version.changeNote ? <p className="mt-1 text-xs text-slate-400">{version.changeNote}</p> : null}</div>{version.status !== "draft" ? <Button size="sm" variant="outline" disabled={saving} onClick={() => action({ action: "restore", key: selected.entry.textKey, locale: "ar", versionId: version.id })}><History className="h-3.5 w-3.5" /> استرجاع</Button> : null}</div>)}</div></div>
        </section> : null}
      </div>
      {message ? <p role="status" className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{message}</p> : null}
    </div>
  );
}

function StatusDot({ row, detailed = false }: { row: TextRow; detailed?: boolean }) {
  const label = row.draft ? "مسودة بانتظار النشر" : row.published ? "منشور" : "غير مهيأ";
  const classes = row.draft ? "bg-amber-100 text-amber-800" : row.published ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${classes}`}>{row.published && !row.draft ? <CheckCircle2 className="h-3 w-3" /> : <FileText className="h-3 w-3" />}{detailed ? label : row.draft ? "مسودة" : "منشور"}</span>;
}

function PreviewCard({ row, value }: { row: TextRow; value: string }) {
  return <aside className="overflow-hidden rounded-2xl border bg-slate-950 text-white shadow-lg"><div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-black text-white/70"><ShieldCheck className="h-4 w-4 text-amber-300" /> معاينة نص المسودة قبل النشر</div><div className="p-5"><p className="text-[11px] font-black uppercase tracking-[.14em] text-violet-300">{row.entry.textKey}</p><p className="mt-3 whitespace-pre-wrap text-base font-bold leading-8">{value || "(سيُعرض نص فارغ عند النشر)"}</p><p className="mt-5 text-xs leading-6 text-white/55">المعاينة تستخدم المسودة فقط؛ الزوار لا يرونها قبل الضغط على «نشر المسودة».</p></div></aside>;
}
