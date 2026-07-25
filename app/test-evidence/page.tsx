export const dynamic = "force-dynamic";

import Link from "next/link";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { TestEvidenceForm } from "@/components/qa/test-evidence-form";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { hasRole, requireAuth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { QA_TEST_CATALOG } from "@/lib/qa/test-catalog";
import { eq } from "drizzle-orm";

export default async function TestEvidencePage() {
  const session = await requireAuth();
  const [user] = await db.select({ isTestAccount: users.isTestAccount }).from(users).where(eq(users.id, session.userId)).limit(1);
  const allowed = Boolean(user?.isTestAccount || hasRole(session, "super_admin"));

  if (!allowed) {
    return <main className="min-h-screen bg-slate-50"><SiteHeader /><section className="container max-w-2xl py-16 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-amber-600" /><h1 className="mt-4 text-2xl font-black">هذه الصفحة مخصصة لفريق الاختبار</h1><p className="mt-3 text-sm text-slate-500">استخدم حساب QA أو راجع مسؤول المنصة لتسجيل دليل الاختبار.</p><Button asChild className="mt-6" variant="outline"><Link href="/">العودة للرئيسية</Link></Button></section></main>;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <section className="container max-w-3xl py-10">
        <div className="mb-7 rounded-[2rem] bg-slate-950 p-6 text-white"><ClipboardCheck className="mb-3 h-8 w-8 text-amber-300" /><h1 className="text-3xl font-black">دليل اختبار الفريق</h1><p className="mt-2 text-sm leading-7 text-white/70">سجل نتيجة المهمة باسم حسابك. لا تضع كلمات مرور أو أسرار أو URLs لقاعدة البيانات في الملاحظات أو الدليل.</p></div>
        <TestEvidenceForm cases={QA_TEST_CATALOG} />
      </section>
    </main>
  );
}
