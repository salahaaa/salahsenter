import Link from "next/link";
import { Languages } from "lucide-react";
import { PlatformTextCenterPanel } from "@/components/admin/platform-text-center-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";

export default async function PlatformTextCenterPage() {
  const session = await requireAuth();
  await assertAdminOperation(session, "system.settings.view");
  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div><div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2 text-xs font-black text-violet-800"><Languages className="h-4 w-4" /> Customer Copy Governance</div><h1 className="mt-4 text-3xl font-black text-slate-950 md:text-5xl">مركز نصوص المتسوق</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">نصوص ثابتة يراها الزائر أو المتسوق فقط، مع مسودات ونشر مدقق واسترجاع نسخ سابقة. أما محتوى الرئيسية والهوية والنافذة الترحيبية والعروض وCMS فيبقى في مديري المحتوى المتخصصين حتى لا يتكرر مصدر النص.</p></div>
          <Button asChild variant="outline"><Link href="/admin">العودة إلى لوحة الأدمن</Link></Button>
        </div>
        <PlatformTextCenterPanel />
      </section>
    </main>
  );
}
