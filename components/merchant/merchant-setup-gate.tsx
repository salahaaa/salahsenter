import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoreSetupStatus } from "@/lib/merchant-readiness";

export function MerchantSetupGate({ status, title = "استكمل تهيئة المتجر قبل إضافة المنتجات" }: { status: StoreSetupStatus; title?: string }) {
  return (
    <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-right shadow-card">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-xs font-black text-amber-800"><CircleAlert className="h-4 w-4" /> إعدادات إجبارية</div>
          <h2 className="text-2xl font-black text-amber-950">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-amber-800">حتى لا يتم حفظ منتج بدون عملة أو قسم أو رقم أو متغيرات، يجب إكمال هذه الخطوات بالترتيب. بعد إكمالها ستظهر بطاقة إضافة المنتج مباشرة.</p>
        </div>
        <Button asChild><Link href="/merchant">لوحة التاجر</Link></Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {status.steps.map((step, index) => (
          <div key={step.key} className="rounded-2xl border bg-white p-4">
            <div className="flex items-start gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${step.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{step.done ? <CheckCircle2 className="h-5 w-5" /> : index + 1}</span>
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-slate-950">{step.title}</h3>
                <p className="mt-1 text-xs leading-6 text-slate-500">{step.description}</p>
                <Button asChild size="sm" variant={step.done ? "outline" : "default"} className="mt-3"><Link href={step.href}>{step.done ? "مراجعة" : "استكمال الآن"}</Link></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
