import Link from "next/link";
import { Bot, FileText, Megaphone, PackagePlus, Sparkles, Tags, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const tools = [
  {
    title: "تجهيز عرض ذكي",
    description: "اقتراح Bundle أو خصم بناءً على المنتجات والمخزون ثم إرساله للأدمن للمراجعة.",
    href: "/merchant/offers",
    icon: Sparkles,
    badge: "AI Offers",
    cta: "افتح العروض"
  },
  {
    title: "تجهيز بنر إعلان",
    description: "مولّد نصوص وفكرة تصميم للبنر: عنوان، وصف، CTA، كلمات مفتاحية وقائمة مراجعة.",
    href: "/merchant/ads",
    icon: Megaphone,
    badge: "AI Banners",
    cta: "افتح الإعلانات"
  },
  {
    title: "وصف المنتج والمتغيرات",
    description: "اكتب فكرة مختصرة والذكاء يجهز الاسم، الوصف، الألوان، المقاسات والمتغيرات.",
    href: "/merchant/products",
    icon: PackagePlus,
    badge: "AI Copy",
    cta: "أضف منتج"
  },
  {
    title: "قوالب نشاط المتجر",
    description: "إنشاء أصناف وخصائص ومقاسات وألوان حسب نشاطك التجاري بضغطة واحدة.",
    href: "/merchant/product-taxonomy",
    icon: Tags,
    badge: "Smart Setup",
    cta: "جهّز الأصناف"
  },
  {
    title: "المساعد التجاري اليومي",
    description: "توصيات حول المخزون، المنتجات الراكدة، تحسين الوصف، والتنبيهات اليومية.",
    href: "/merchant/ai-assistant",
    icon: Bot,
    badge: "Assistant",
    cta: "افتح المساعد"
  },
  {
    title: "الإعداد الذكي للمتجر",
    description: "تجهيز المتجر من ناحية الأقسام، البانرات، وصف النشاط وبعض البيانات الأولية.",
    href: "/merchant/smart-setup",
    icon: Wand2,
    badge: "AI Setup",
    cta: "ابدأ الإعداد"
  }
];

export function MerchantSmartLaunchpad() {
  return (
    <section className="mb-8 rounded-[2rem] border bg-white p-6 shadow-card">
      <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <div className="mb-2 inline-flex rounded-full bg-indigo-50 px-4 py-2 text-xs font-black text-indigo-700">AI Merchant Command Center</div>
          <h2 className="text-2xl font-black text-slate-950">مركز الأدوات الذكية للتاجر</h2>
          <p className="mt-1 max-w-3xl text-sm leading-7 text-slate-500">جمعنا كل الإضافات الذكية في مكان واضح: تجهيز عروض، بنرات إعلانية، وصف منتجات، متغيرات، قوالب نشاط وتوصيات تشغيلية.</p>
        </div>
        <Button asChild variant="outline"><Link href="/merchant">لوحة التاجر</Link></Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.title} href={tool.href} className="group rounded-3xl border bg-slate-50 p-5 transition hover:-translate-y-1 hover:border-indigo-200 hover:bg-indigo-50/50 hover:shadow-soft">
              <div className="mb-4 flex items-start justify-between gap-3">
                <span className="rounded-2xl bg-white p-3 text-indigo-700 shadow-sm"><Icon className="h-6 w-6" /></span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700">{tool.badge}</span>
              </div>
              <h3 className="text-lg font-black text-slate-950">{tool.title}</h3>
              <p className="mt-2 min-h-14 text-sm leading-7 text-slate-600">{tool.description}</p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-black text-indigo-700"><FileText className="h-4 w-4" /> {tool.cta}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
