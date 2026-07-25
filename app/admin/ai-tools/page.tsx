export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { Bot, BrainCircuit, ClipboardList, Eye, Megaphone, ShieldAlert, Sparkles, Store } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";

const tools = [
  {
    title: "مركز ذكاء الأدمن", description: "تحليل طابور العمل والاقتراحات مع موافقة بشرية وسجل تدقيق.", href: "/admin/ai-workbench", icon: Bot, badge: "AI Workbench"
  },
  {
    title: "تلخيص طلبات فتح المتاجر",
    description: "داخل تفاصيل طلب التاجر يظهر زر AI Summary لتلخيص النشاط والوثائق والمخاطر ونقاط القرار.",
    href: "/admin/merchant-applications",
    icon: ClipboardList,
    badge: "Applications AI"
  },
  {
    title: "مراجعة إعلانات المتاجر",
    description: "داخل إدارة الإعلانات يظهر مساعد AI Review لتحليل الإعلان، جودة الصورة، المخاطر، والقرار المقترح.",
    href: "/admin/ads",
    icon: Megaphone,
    badge: "Ads AI"
  },
  {
    title: "مساعد مراقبة المنصة",
    description: "تحليل Redis وDB وQueue والبحث والمنتجات الناقصة الصور، مع توصيات تشغيلية للأدمن.",
    href: "/admin/observability",
    icon: BrainCircuit,
    badge: "Ops AI"
  },
  {
    title: "مركز حماية المنصة الذكي",
    description: "كشف تهديدات، incidents، root cause، self-healing، ووضع الطوارئ عند الخطر.",
    href: "/admin/security",
    icon: ShieldAlert,
    badge: "Security AI"
  },
  {
    title: "مراجعة العروض الموسمية",
    description: "مراجعة عروض التجار المجمعة، الأسعار، الكميات، وربطها بواجهة العروض.",
    href: "/admin/offers",
    icon: Sparkles,
    badge: "Offers"
  },
  {
    title: "إدارة المتاجر والجاهزية",
    description: "متابعة حالة المتاجر، التجميد، التفعيل، الصور، والبيانات الناقصة قبل الإطلاق.",
    href: "/admin/stores",
    icon: Store,
    badge: "Stores"
  }
];

export default async function AdminAiToolsPage() {
  const session = await requireAuth();
  await assertAdmin(session, "admin.access");
  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-violet-50 px-4 py-2 text-xs font-black text-violet-700"><Bot className="h-4 w-4" /> Admin AI Command Center</div>
            <h1 className="text-3xl font-black text-slate-950 md:text-5xl">مركز إضافات الأدمن الذكية</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">هذه الصفحة تجمع كل أدوات الذكاء الخاصة بالإدارة في مكان واحد حتى لا تبقى مخفية داخل صفحات المراجعة.</p>
          </div>
          <Button asChild variant="outline"><Link href="/admin">العودة</Link></Button>
        </div>

        <section className="rounded-[2rem] border bg-white p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-slate-950">اختصارات الأدوات الذكية</h2>
              <p className="mt-1 text-sm text-slate-500">افتح الصفحة المطلوبة وستجد أزرار الذكاء داخل تفاصيل الطلب/الإعلان أو في لوحة المراقبة.</p>
            </div>
            <Badge variant="success">AI Ready</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.title} href={tool.href} className="group rounded-3xl border bg-slate-50 p-5 transition hover:-translate-y-1 hover:border-violet-200 hover:bg-violet-50/50 hover:shadow-soft">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <span className="rounded-2xl bg-white p-3 text-violet-700 shadow-sm"><Icon className="h-6 w-6" /></span>
                    <Badge variant="outline">{tool.badge}</Badge>
                  </div>
                  <h3 className="text-lg font-black text-slate-950">{tool.title}</h3>
                  <p className="mt-2 min-h-20 text-sm leading-7 text-slate-600">{tool.description}</p>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-black text-violet-700"><Eye className="h-4 w-4" /> فتح الأداة</div>
                </Link>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
