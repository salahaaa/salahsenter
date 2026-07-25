"use client";

import { CheckCircle2, Circle, Clock3, FileSignature, ShieldCheck, Store } from "lucide-react";
import { cn } from "@/lib/utils";
// Re-export so existing imports keep working, but the source lives in a server-safe module.
export { statusLabels, nextApplicationHint } from "@/lib/application-flow";
export type { ApplicationStatus } from "@/lib/application-flow";
import type { ApplicationStatus } from "@/lib/application-flow";
import { statusLabels } from "@/lib/application-flow";

const steps = [
  { id: "submitted", title: "إرسال الطلب", description: "استلام بيانات المتجر وربطها بحساب مقدم الطلب.", icon: Store, statuses: ["new", "pending", "under_review", "waiting_for_data", "documents_required", "pre_approved", "contract_created", "contract_signed", "waiting_final_approval", "approved", "active", "rejected"] },
  { id: "review", title: "مراجعة الإدارة", description: "فحص النشاط والبيانات والمستندات قبل إنشاء العقد.", icon: ShieldCheck, statuses: ["under_review", "waiting_for_data", "documents_required", "pre_approved", "contract_created", "contract_signed", "waiting_final_approval", "approved", "active", "rejected"] },
  { id: "contract", title: "إرسال العقد", description: "لا يظهر العقد للتوقيع إلا بعد إرسال الإدارة له.", icon: FileSignature, statuses: ["contract_created", "contract_signed", "waiting_final_approval", "approved", "active"] },
  { id: "signature", title: "توقيع التاجر", description: "توقيع إلكتروني وحفظ نسخة العقد الموقعة.", icon: CheckCircle2, statuses: ["contract_signed", "waiting_final_approval", "approved", "active"] },
  { id: "activation", title: "التفعيل النهائي", description: "بعد الموافقة النهائية يتم إنشاء المتجر وفتح لوحة التاجر.", icon: Clock3, statuses: ["approved", "active"] }
] as const;

export function ApplicationFlowTimeline({ status }: { status: string }) {
  const currentStatus = status as ApplicationStatus;
  const rejected = currentStatus === "rejected";
  return (
    <div className="rounded-[2rem] border bg-white p-5 shadow-card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-right">
        <div>
          <h2 className="text-xl font-black text-slate-950">مسار فتح المتجر</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">يوضح أين وصل الطلب وما الخطوة التالية قبل تفعيل المتجر.</p>
        </div>
        <span className={cn("rounded-full px-4 py-2 text-xs font-black", rejected ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-700")}>{statusLabels[currentStatus] || status}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {steps.map((step, index) => {
          const done = !rejected && step.statuses.includes(currentStatus as never);
          const Icon = done ? CheckCircle2 : step.icon || Circle;
          return (
            <div key={step.id} className={cn("relative rounded-3xl border p-4 text-right", done ? "border-blue-200 bg-blue-50" : rejected && index > 0 ? "border-red-100 bg-red-50/60" : "bg-slate-50")}> 
              <div className={cn("mb-3 inline-grid h-10 w-10 place-items-center rounded-2xl", done ? "bg-blue-600 text-white" : rejected && index > 0 ? "bg-red-100 text-red-600" : "bg-white text-slate-400")}> <Icon className="h-5 w-5" /></div>
              <h3 className="font-black text-slate-950">{step.title}</h3>
              <p className="mt-2 text-xs font-semibold leading-6 text-slate-500">{step.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
