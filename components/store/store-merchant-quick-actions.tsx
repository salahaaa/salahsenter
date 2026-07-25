import Link from "next/link";
import { Megaphone, Newspaper, PackagePlus, Settings, Image as ImageIcon, Tags } from "lucide-react";

const actions = [
  { href: "/merchant/products", label: "إضافة منتج", icon: PackagePlus, tone: "bg-blue-600" },
  { href: "/merchant/announcements", label: "إضافة إعلان", icon: Megaphone, tone: "bg-orange-500" },
  { href: "/merchant/news", label: "إضافة خبر", icon: Newspaper, tone: "bg-emerald-600" },
  { href: "/merchant/offers", label: "إضافة عرض", icon: Tags, tone: "bg-purple-600" },
  { href: "/merchant/media", label: "صور المتجر", icon: ImageIcon, tone: "bg-pink-600" },
  { href: "/merchant/settings", label: "إعدادات", icon: Settings, tone: "bg-slate-800" }
];

export function StoreMerchantQuickActions() {
  return (
    <div className="container -mt-4 pb-2 print:hidden">
      <div className="rounded-[1.7rem] border border-amber-200 bg-amber-50/95 p-4 shadow-card">
        <div className="mb-3 text-right">
          <p className="text-sm font-black text-amber-900">اختصارات التاجر — لا تظهر للمتسوقين</p>
          <p className="mt-1 text-xs font-bold text-amber-700">أضف ما يظهر على واجهة المتجر بسرعة بدون الرجوع للقوائم.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="flex items-center justify-center gap-2 rounded-2xl bg-white px-3 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <span className={`grid h-8 w-8 place-items-center rounded-xl text-white ${action.tone}`}><Icon className="h-4 w-4" /></span>
                {action.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
