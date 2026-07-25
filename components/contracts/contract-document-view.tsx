"use client";

import Link from "next/link";
import { CalendarDays, Download, FileSignature, Printer, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Application = {
  id: string;
  storeName: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string | null;
  businessActivity: string;
  status: string;
  contractTitle: string;
  contractVersion: string;
  onboardingContractNumber?: string | null;
  contractStartAt?: string | null;
  contractEndAt?: string | null;
  commissionRate?: string | null;
  subscriptionFee?: string | null;
};

export function ContractDocumentView({ application, contractBody }: { application: Application; contractBody: string }) {
  const paragraphs = contractBody.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  return (
    <article className="overflow-hidden rounded-[2rem] border bg-white shadow-card" id="contract-document">
      <div className="border-b bg-gradient-to-l from-slate-950 via-slate-900 to-blue-950 p-6 text-white md:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div className="text-right">
            <Badge className="mb-4 bg-white/10 text-white"><FileSignature className="ml-1 h-4 w-4 text-amber-300" /> عقد إلكتروني</Badge>
            <h2 className="text-3xl font-black md:text-4xl">{application.contractTitle}</h2>
            <p className="mt-3 text-sm leading-7 text-white/65">نسخة عقد منظمة للمراجعة والتوقيع الإلكتروني. اقرأ البنود ثم وقّع من اللوحة الجانبية.</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button type="button" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => window.print()}><Printer className="h-4 w-4" /> طباعة</Button>
            <Button asChild variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20"><a href={`data:text/plain;charset=utf-8,${encodeURIComponent(contractBody)}`} download={`contract-${application.storeName}.txt`}><Download className="h-4 w-4" /> تنزيل نص العقد</a></Button>
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
        <aside className="border-l bg-slate-50 p-5 text-right">
          <h3 className="font-black text-slate-950">ملخص العقد</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Summary label="المتجر" value={application.storeName} />
            <Summary label="صاحب الطلب" value={application.applicantName} />
            <Summary label="النشاط" value={application.businessActivity} />
            <Summary label="البريد" value={application.applicantEmail} />
            <Summary label="رقم العقد" value={application.onboardingContractNumber || "يُحدد عند الإرسال"} />
            <Summary label="الإصدار" value={application.contractVersion} />
            <Summary label="العمولة" value={`${application.commissionRate || "0"}%`} />
            <Summary label="رسوم الاشتراك" value={application.subscriptionFee || "0"} />
          </dl>
          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs font-bold leading-6 text-blue-800">
            <ShieldCheck className="mb-2 h-5 w-5" /> لا يتم تفعيل المتجر إلا بعد توقيع العقد ثم موافقة الأدمن النهائية.
          </div>
          <Button asChild variant="outline" className="mt-4 w-full print:hidden"><Link href={`/apply-store/${application.id}`}>متابعة حالة الطلب</Link></Button>
        </aside>

        <div className="space-y-4 p-5 md:p-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-slate-50 p-4 text-sm font-bold text-slate-600">
            <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" /> تاريخ البداية: {application.contractStartAt ? new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date(application.contractStartAt)) : "بعد الإرسال"}</span>
            <span>تاريخ النهاية: {application.contractEndAt ? new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date(application.contractEndAt)) : "بعد الإرسال"}</span>
          </div>
          {paragraphs.map((paragraph, index) => (
            <section key={index} className="rounded-2xl border bg-white p-5 text-right shadow-sm">
              <h3 className="mb-3 text-sm font-black text-blue-700">البند {index + 1}</h3>
              <p className="whitespace-pre-wrap text-sm leading-8 text-slate-700">{paragraph}</p>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white px-3 py-2"><dt className="text-xs font-bold text-slate-400">{label}</dt><dd className="mt-1 break-words font-black text-slate-800">{value}</dd></div>;
}
