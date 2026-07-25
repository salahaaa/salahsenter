"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { apiClient, ApiClientError } from "@/lib/client/api-client";

const fulfillmentSteps = [
  { code: "confirmed", label: "تأكيد", helper: "تم قبول الطلب" },
  { code: "preparing", label: "قيد التجهيز", helper: "بدأ تجهيز المنتجات" },
  { code: "ready_to_ship", label: "جاهز للشحن", helper: "جاهز للتسليم لشركة الشحن" },
  { code: "shipped", label: "تم الشحن", helper: "خرج الطلب من المتجر" },
  { code: "delivered", label: "تم التسليم", helper: "وصل للعميل" },
  { code: "closed", label: "إغلاق", helper: "اكتملت دورة الطلب" }
] as const;

const terminalActions = [
  { code: "cancelled", label: "إلغاء", helper: "إيقاف الطلب وإرجاع الحجز" }
] as const;

const paymentActions = [
  { code: "paid", label: "تأكيد الدفع", helper: "الدفع مؤكد" },
  { code: "refunded", label: "استرداد", helper: "تم/سيتم رد المبلغ" },
  { code: "failed", label: "فشل الدفع", helper: "تعذر تحصيل الدفع" }
] as const;

const statusLabels: Record<string, string> = {
  new: "جديد",
  confirmed: "مؤكد",
  preparing: "قيد التجهيز",
  ready_to_ship: "جاهز للشحن",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  closed: "مغلق",
  cancelled: "ملغي"
};

const paymentLabels: Record<string, string> = {
  pending: "بانتظار الدفع",
  paid: "مدفوع",
  failed: "فشل الدفع",
  refunded: "مسترد"
};

type FulfillmentStepCode = (typeof fulfillmentSteps)[number]["code"];
type PaymentActionCode = (typeof paymentActions)[number]["code"];
type StepState = "done" | "current" | "future" | "cancelled";
type PaymentState = "done" | "current" | "future" | "danger";

const fulfillmentOrder = fulfillmentSteps.map((step) => step.code);

function getFulfillmentState(currentStatus: string, stepCode: FulfillmentStepCode): StepState {
  if (currentStatus === "cancelled") return "future";
  const currentIndex = fulfillmentOrder.indexOf(currentStatus as FulfillmentStepCode);
  const stepIndex = fulfillmentOrder.indexOf(stepCode);
  if (currentIndex === -1) return "future";
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "current";
  return "future";
}

function getPaymentState(currentPaymentStatus: string, actionCode: PaymentActionCode): PaymentState {
  if (currentPaymentStatus === actionCode) return actionCode === "failed" ? "danger" : "current";
  if (currentPaymentStatus === "refunded" && actionCode === "paid") return "done";
  return "future";
}

function fulfillmentButtonClass(state: StepState, compact: boolean) {
  const base = compact
    ? "h-auto min-h-9 justify-start gap-2 rounded-xl px-2 py-2 text-right text-xs"
    : "h-auto min-h-[4.25rem] justify-start gap-3 rounded-2xl px-3 py-3 text-right";
  const states: Record<StepState, string> = {
    done: "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-emerald-500/10 ring-1 ring-emerald-100 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-900",
    current: "border-blue-300 bg-gradient-to-l from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-lg shadow-blue-600/25 ring-2 ring-blue-200 hover:from-blue-700 hover:via-indigo-700 hover:to-cyan-600 hover:text-white",
    future: "border-slate-200 bg-white text-slate-500 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700",
    cancelled: "border-rose-300 bg-rose-50 text-rose-700 shadow-rose-500/10 ring-1 ring-rose-100 hover:border-rose-400 hover:bg-rose-100 hover:text-rose-800"
  };
  return `${base} ${states[state]}`;
}

function paymentButtonClass(state: PaymentState, compact: boolean) {
  const base = compact
    ? "h-auto min-h-9 justify-start gap-2 rounded-xl px-2 py-2 text-right text-xs"
    : "h-auto min-h-[3.75rem] justify-start gap-3 rounded-2xl px-3 py-3 text-right";
  const states: Record<PaymentState, string> = {
    done: "border-emerald-200 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100 hover:bg-emerald-100 hover:text-emerald-900",
    current: "border-emerald-300 bg-gradient-to-l from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-200 hover:from-emerald-700 hover:to-teal-600 hover:text-white",
    danger: "border-rose-300 bg-gradient-to-l from-rose-600 to-red-500 text-white shadow-lg shadow-rose-500/20 ring-2 ring-rose-200 hover:from-rose-700 hover:to-red-600 hover:text-white",
    future: "border-slate-200 bg-white text-slate-500 shadow-sm hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
  };
  return `${base} ${states[state]}`;
}

function markerClass(state: StepState | PaymentState, compact: boolean) {
  const size = compact ? "h-5 w-5 text-[10px]" : "h-8 w-8 text-xs";
  if (state === "done") return `${size} grid shrink-0 place-items-center rounded-full bg-emerald-600 font-black text-white`;
  if (state === "current") return `${size} grid shrink-0 place-items-center rounded-full bg-white font-black text-blue-700 shadow-sm`;
  if (state === "danger" || state === "cancelled") return `${size} grid shrink-0 place-items-center rounded-full bg-white font-black text-rose-700 shadow-sm`;
  return `${size} grid shrink-0 place-items-center rounded-full bg-slate-100 font-black text-slate-400`;
}

function markerText(state: StepState | PaymentState, index: number) {
  if (state === "done") return "✓";
  if (state === "current") return "●";
  if (state === "danger" || state === "cancelled") return "!";
  return String(index + 1);
}

export function OrderStatusActions({
  orderId,
  statusCode = "new",
  paymentStatus = "pending",
  compact = false
}: {
  orderId: string;
  statusCode?: string;
  paymentStatus?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ statusCode?: string; paymentStatus?: "pending" | "paid" | "failed" | "refunded" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currentStatusLabel = statusLabels[statusCode] || statusCode;
  const currentPaymentLabel = paymentLabels[paymentStatus] || paymentStatus;

  const cancelledState = statusCode === "cancelled" ? "cancelled" : "future";
  const completedCount = useMemo(() => fulfillmentSteps.filter((step) => getFulfillmentState(statusCode, step.code) === "done").length, [statusCode]);

  function update(input: { statusCode?: string; paymentStatus?: "pending" | "paid" | "failed" | "refunded" }) {
    setError(null);
    setPendingUpdate(input);
  }

  async function confirmUpdate(reason: string) {
    if (!pendingUpdate) return;
    setLoading(true); setError(null);
    try {
      await apiClient.patch(`/api/orders/${orderId}/status`, { ...pendingUpdate, note: reason || undefined }, { invalidateTags: ["merchant:orders", `order:${orderId}`] });
      setPendingUpdate(null); router.refresh();
    } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : "تعذر تحديث الطلب"); }
    finally { setLoading(false); }
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <section className={compact ? "space-y-2" : "rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm"}>
        {!compact ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-950">مسار تنفيذ الطلب</h3>
              <p className="mt-1 text-xs font-bold text-slate-500">الأخضر = مرحلة منجزة، الأزرق = المرحلة الحالية، الرمادي = المرحلة القادمة.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-blue-50 text-blue-700">الحالة الحالية: {currentStatusLabel}</Badge>
              <Badge variant="outline">منجزة: {completedCount} / {fulfillmentSteps.length}</Badge>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
            <span>الحالة:</span><Badge className="bg-blue-50 text-blue-700">{currentStatusLabel}</Badge>
          </div>
        )}

        <div className={compact ? "flex flex-wrap gap-2" : "grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-7"}>
          {fulfillmentSteps.map((status, index) => {
            const state = getFulfillmentState(statusCode, status.code);
            return (
              <Button key={status.code} type="button" size="sm" variant="outline" disabled={loading} className={fulfillmentButtonClass(state, compact)} onClick={() => update({ statusCode: status.code })}>
                <span className={markerClass(state, compact)}>{markerText(state, index)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black">{status.label}</span>
                  {!compact ? <span className={`mt-1 block text-[11px] leading-5 ${state === "current" ? "text-white/80" : "text-slate-500"}`}>{status.helper}</span> : null}
                </span>
                {state === "current" ? <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-black">الحالية</span> : null}
              </Button>
            );
          })}

          {terminalActions.map((status, index) => (
            <Button key={status.code} type="button" size="sm" variant="outline" disabled={loading} className={fulfillmentButtonClass(cancelledState, compact)} onClick={() => update({ statusCode: status.code })}>
              <span className={markerClass(cancelledState, compact)}>{markerText(cancelledState, fulfillmentSteps.length + index)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-black">{status.label}</span>
                {!compact ? <span className={`mt-1 block text-[11px] leading-5 ${cancelledState === "cancelled" ? "text-rose-700/80" : "text-slate-500"}`}>{status.helper}</span> : null}
              </span>
              {cancelledState === "cancelled" ? <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-black text-rose-700">الحالية</span> : null}
            </Button>
          ))}
        </div>
      </section>

      <section className={compact ? "space-y-2 border-t pt-2" : "rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"}>
        {!compact ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-950">حالة الدفع</h3>
              <p className="mt-1 text-xs font-bold text-slate-500">تظهر حالة الدفع بلون واضح حتى يعرف الموظف هل اكتمل التحصيل أم لا.</p>
            </div>
            <Badge className={paymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : paymentStatus === "failed" ? "bg-rose-50 text-rose-700" : paymentStatus === "refunded" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}>الدفع: {currentPaymentLabel}</Badge>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
            <span>الدفع:</span><Badge className={paymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : paymentStatus === "failed" ? "bg-rose-50 text-rose-700" : paymentStatus === "refunded" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}>{currentPaymentLabel}</Badge>
          </div>
        )}
        <div className={compact ? "flex flex-wrap gap-2" : "grid gap-2 sm:grid-cols-3"}>
          {paymentActions.map((action, index) => {
            const state = getPaymentState(paymentStatus, action.code);
            return (
              <Button key={action.code} type="button" size="sm" variant="outline" disabled={loading} className={paymentButtonClass(state, compact)} onClick={() => update({ paymentStatus: action.code })}>
                <span className={markerClass(state, compact)}>{markerText(state, index)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black">{action.label}</span>
                  {!compact ? <span className={`mt-1 block text-[11px] leading-5 ${state === "current" || state === "danger" ? "text-white/80" : "text-slate-500"}`}>{action.helper}</span> : null}
                </span>
                {state === "current" || state === "danger" ? <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-black">الحالية</span> : null}
              </Button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
