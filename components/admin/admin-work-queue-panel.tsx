"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock3, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type WorkItem = {
  workKey: string; queue: string; priority: "critical" | "high" | "normal" | "low"; entityType: string; entityId: string; title: string; description: string; href: string; createdAt: string | Date; dueAt: string | Date;
  assignment: { status: string; assignedTo: string | null; dueAt: string | Date | null } | null;
};
type Assignee = { id: string; name: string; email: string };

const priorityVariant = { critical: "danger", high: "warning", normal: "outline", low: "outline" } as const;

export function AdminWorkQueuePanel({ initialItems, assignees }: { initialItems: WorkItem[]; assignees: Assignee[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [queue, setQueue] = useState("all");
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const visible = useMemo(() => queue === "all" ? items : items.filter((item) => item.queue === queue), [items, queue]);
  const queues = [...new Set(items.map((item) => item.queue))];

  async function update(item: WorkItem, status: "assigned" | "resolved" | "open", assignedTo?: string | null) {
    setLoading(`${item.workKey}:${status}`);
    const response = await fetch("/api/admin/work-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workKey: item.workKey, entityType: item.entityType, entityId: item.entityId, queue: item.queue, priority: item.priority, status, assignedTo: assignedTo ?? item.assignment?.assignedTo ?? null, dueAt: item.dueAt ? new Date(item.dueAt).toISOString() : null })
    });
    const json = await response.json().catch(() => ({}));
    setLoading(null);
    setMessage(response.ok ? "✓ تم تحديث المهمة" : json.message || "تعذر تحديث المهمة");
    if (response.ok) router.refresh();
  }

  return <div className="space-y-6"><section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 shadow-card"><div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-primary"/><b>{items.length} مهمة مفتوحة</b></div><div className="flex flex-wrap gap-2"><Button size="sm" variant={queue === "all" ? "default" : "outline"} onClick={() => setQueue("all")}>الكل</Button>{queues.map((key) => <Button key={key} size="sm" variant={queue === key ? "default" : "outline"} onClick={() => setQueue(key)}>{key}</Button>)}</div></section>{message ? <p className="rounded-2xl border bg-white p-4 text-sm font-bold text-slate-700">{message}</p> : null}<section className="space-y-3">{visible.map((item) => { const overdue = new Date(item.dueAt).getTime() < Date.now(); const currentAssignee = item.assignment?.assignedTo || ""; return <article key={item.workKey} className="rounded-3xl border bg-white p-5 shadow-card"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div className="min-w-0"><div className="flex flex-wrap gap-2"><Badge variant={priorityVariant[item.priority]}>{item.priority}</Badge><Badge variant="outline">{item.queue}</Badge>{overdue ? <Badge variant="danger">SLA متأخر</Badge> : <Badge variant="success">ضمن SLA</Badge>}</div><h3 className="mt-3 font-black text-slate-950">{item.title}</h3><p className="mt-1 text-sm text-slate-500">{item.description}</p><p className="mt-2 text-xs font-bold text-slate-400">الاستحقاق: {new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.dueAt))}</p></div><div className="flex min-w-[280px] flex-col gap-2"><select value={currentAssignee} onChange={(event) => void update(item, "assigned", event.target.value || null)} className="h-10 rounded-xl border bg-white px-3 text-sm"><option value="">إسناد إلى موظف</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name} — {person.email}</option>)}</select><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><Link href={item.href}>فتح المهمة</Link></Button><Button size="sm" disabled={loading === `${item.workKey}:resolved`} onClick={() => void update(item, "resolved")}>{loading === `${item.workKey}:resolved` ? "..." : <><CheckCircle2 className="h-4 w-4"/> إنهاء</>}</Button></div></div></div></article>})}</section>{!visible.length ? <div className="rounded-3xl border bg-emerald-50 p-8 text-center font-black text-emerald-700">لا توجد مهام مطابقة في هذا الطابور.</div> : null}</div>;
}
