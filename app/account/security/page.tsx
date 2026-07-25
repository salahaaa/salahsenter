export const dynamic = "force-dynamic";

import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";

export default async function AccountSecurityPage({ searchParams }: { searchParams: Promise<{ mustChangePassword?: string }> }) {
  const session = await requireAuth();
  const { mustChangePassword } = await searchParams;
  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <section className="container max-w-3xl py-10">
        {mustChangePassword === "1" ? <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-900">لأمان الحساب، يجب تعيين كلمة مرور جديدة قبل متابعة استخدام المنصة. بعد الحفظ سيتم تسجيل خروجك من كل الأجهزة ثم تدخل بكلمة المرور الجديدة.</div> : null}
        <section className="rounded-[2rem] border bg-white p-6 shadow-card md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700"><ShieldCheck className="h-3.5 w-3.5" /> حساب محمي</div><h1 className="mt-4 text-3xl font-black text-slate-950">أمان الحساب</h1><p className="mt-2 text-sm leading-7 text-slate-500">الحساب: {session.fullName} — {session.email}</p></div><KeyRound className="h-9 w-9 text-primary" /></div>
          <div className="mt-7"><ChangePasswordForm /></div>
          <Button asChild variant="outline" className="mt-6"><Link href="/">العودة للرئيسية</Link></Button>
        </section>
      </section>
    </main>
  );
}
