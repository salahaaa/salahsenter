"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileSignature, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

type Action = "start_review" | "request_documents" | "request_changes" | "pre_approve" | "create_contract" | "reject";

const actions: Array<{ value: Action; label: string; help: string; allowed: string[]; tone?: "danger" | "primary" }> = [
  { value: "start_review", label: "بدء المراجعة", help: "ينقل الطلب إلى قيد المراجعة ويشعر مقدم الطلب.", allowed: ["pending", "new", "waiting_for_data"] },
  { value: "request_documents", label: "طلب مستندات", help: "اطلب مستنداً أو ملفاً ناقصاً من مقدم الطلب.", allowed: ["pending", "new", "under_review", "pre_approved"] },
  { value: "request_changes", label: "طلب تعديل بيانات", help: "أعد الطلب للتاجر لتعديل بيانات محددة.", allowed: ["pending", "new", "under_review", "pre_approved", "contract_created"] },
  { value: "pre_approve", label: "قبول مبدئي", help: "اعتماد مبدئي قبل إنشاء العقد.", allowed: ["under_review", "documents_required", "waiting_for_data"], tone: "primary" },
  { value: "create_contract", label: "إرسال العقد للتوقيع", help: "ينشئ العقد ويجعله ظاهراً للتاجر للتوقيع.", allowed: ["pre_approved"], tone: "primary" },
  { value: "reject", label: "رفض الطلب", help: "يرفض الطلب مع حفظ السبب وإشعار مقدم الطلب.", allowed: ["pending", "new", "under_review", "documents_required", "waiting_for_data", "pre_approved", "contract_created"], tone: "danger" }
];

export function MerchantApplicationReviewActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const availableActions = useMemo(() => actions.filter((action) => action.allowed.includes(status)), [status]);
  const [selectedAction, setSelectedAction] = useState<Action>(availableActions[0]?.value || "start_review");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selected = actions.find((action) => action.value === selectedAction) || actions[0];
  const canRun = selected.allowed.includes(status);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRun) return setMessage("هذا الإجراء غير متاح في الحالة الحالية.");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {
      action: selectedAction,
      adminNote: String(form.get("adminNote") || "").trim() || undefined
    };
    if (selectedAction === "create_contract") {
      payload.contractDurationDays = Number(form.get("contractDurationDays") || 365);
      payload.revenueModel = form.get("revenueModel") || "monthly_rent";
      payload.monthlyRent = Number(form.get("monthlyRent") || 0);
      payload.commissionRate = Number(form.get("commissionRate") || 0);
      payload.dueDays = Number(form.get("dueDays") || 7);
      payload.graceDays = Number(form.get("graceDays") || 7);
      payload.subscriptionFee = Number(form.get("monthlyRent") || 0);
      payload.contractBody = String(form.get("contractBody") || "").trim() || undefined;
    }

    setLoading(true);
    setMessage(null);
    const response = await fetch(`/api/admin/merchant-applications/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return setMessage(json.message || "تعذر تنفيذ الإجراء");
    setMessage("✓ تم تحديث الطلب وإرسال التنبيه المناسب");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-[2rem] border bg-white p-5 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          <Label>الإجراء الإداري</Label>
          <select value={selectedAction} onChange={(event) => setSelectedAction(event.target.value as Action)} className="h-12 w-full rounded-xl border bg-white px-4 text-sm font-bold">
            {actions.map((action) => <option key={action.value} value={action.value} disabled={!action.allowed.includes(status)}>{action.label}</option>)}
          </select>
          <p className="text-xs leading-6 text-slate-500">{selected.help}</p>
        </div>
        <div className="space-y-2">
          <Label>ملاحظة الإدارة للمتقدم</Label>
          <Textarea name="adminNote" placeholder="اكتب سبب الطلب أو ملاحظة واضحة تظهر في التنبيهات وصفحة متابعة الطلب" className="min-h-24" />
        </div>
      </div>

      {selectedAction === "create_contract" ? (
        <div className="rounded-3xl border border-blue-100 bg-blue-50 p-4">
          <div className="mb-4 flex items-center gap-2 text-blue-900"><FileSignature className="h-5 w-5" /><h3 className="font-black">إعدادات العقد قبل الإرسال للتوقيع</h3></div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2"><Label>مدة العقد بالأيام</Label><Input name="contractDurationDays" type="number" defaultValue={365} min={1} /></div>
            <div className="space-y-2"><Label>نموذج إيراد المنصة</Label><select name="revenueModel" className="h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="monthly_rent">إيجار شهري فقط</option><option value="sales_commission">عمولة مبيعات فقط</option><option value="hybrid">إيجار + عمولة</option></select></div>
            <div className="space-y-2"><Label>الإيجار الشهري</Label><Input name="monthlyRent" type="number" defaultValue={0} min={0} /></div>
            <div className="space-y-2"><Label>نسبة العمولة %</Label><Input name="commissionRate" type="number" defaultValue={0} min={0} max={100} step="0.1" /></div>
            <div className="space-y-2"><Label>أيام الاستحقاق</Label><Input name="dueDays" type="number" defaultValue={7} min={1} max={90} /></div>
            <div className="space-y-2"><Label>أيام السماح</Label><Input name="graceDays" type="number" defaultValue={7} min={0} max={90} /></div>
            <div className="space-y-2 md:col-span-3"><Label>نص عقد مخصص اختياري</Label><Textarea name="contractBody" placeholder="اتركه فارغاً ليستخدم النظام قالب العقد الافتراضي" className="min-h-32" /></div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={loading || !canRun} variant={selected.tone === "danger" ? "destructive" : "default"}>
          <Send className="h-4 w-4" /> {loading ? "جارٍ التنفيذ..." : selected.label}
        </Button>
        {!canRun ? <span className="text-sm font-bold text-slate-500">هذا الإجراء غير متاح من الحالة الحالية: {status}</span> : null}
        {message ? <span className={`rounded-xl px-3 py-2 text-sm font-bold ${message.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{message}</span> : null}
      </div>
    </form>
  );
}
