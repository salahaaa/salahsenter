import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BellRing,
  Bot,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileText,
  Gauge,
  Image,
  LayoutDashboard,
  LineChart,
  Megaphone,
  Package,
  PackageCheck,
  PackagePlus,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tags,
  Truck,
  Users,
  WalletCards,
  Wand2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import { StoreLinkActions } from "@/components/merchant/store-link-actions";
import { MerchantStoreSwitcher } from "@/components/merchant/merchant-store-switcher";

type DashboardData = Awaited<ReturnType<typeof import("@/lib/merchant-dashboard").getMerchantDashboardData>>;
type DashboardStore = NonNullable<DashboardData["store"]>;
type HealthItem = DashboardData["storeHealth"][number];
type AlertItem = DashboardData["operationalAlerts"][number];

type ActionItem = {
  title: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  color: string;
  badge?: string;
};

const actionGroups: Array<{ title: string; subtitle: string; items: ActionItem[] }> = [
  {
    title: "المبيعات والتشغيل اليومي",
    subtitle: "أدوات متابعة الطلبات، المخزون، التقارير، وأداء اليوم.",
    items: [
      { title: "الطلبات", desc: "لوحة متابعة وتغيير حالات الطلبات", href: "/merchant/orders", icon: ShoppingBag, color: "from-blue-600 to-cyan-400", badge: "تشغيل" },
      { title: "المخزون", desc: "إضافة، خصم، تسوية، ومراقبة قرب النفاد", href: "/merchant/inventory", icon: Boxes, color: "from-emerald-600 to-teal-400", badge: "حيوي" },
      { title: "التقارير", desc: "مبيعات وطلبات ومؤشرات أداء متقدمة", href: "/merchant/reports", icon: BarChart3, color: "from-violet-600 to-fuchsia-500" }
    ]
  },
  {
    title: "الكتالوج والمنتجات",
    subtitle: "إدارة منتجات احترافية بمتغيرات، خصائص، وصور مرنة.",
    items: [
      { title: "الإضافات الذكية", desc: "إضافة بالصوت، Excel/CSV، باركود أو صورة", href: "/merchant/smart-tools", icon: Wand2, color: "from-indigo-600 to-cyan-500", badge: "AI" },
      { title: "إدارة المنتجات", desc: "إنشاء وتحديث المنتجات والمتغيرات والأسعار", href: "/merchant/products", icon: PackagePlus, color: "from-amber-400 to-orange-500", badge: "مبيعات" },
      { title: "استوديو محتوى AI", desc: "تحسين محتوى المنتج بعد معاينتك وموافقتك", href: "/merchant/ai-product-studio", icon: Wand2, color: "from-violet-600 to-fuchsia-500", badge: "AI Copy" },
      { title: "ذكاء الأصناف والمتغيرات", desc: "Blueprint للتصنيف والخصائص وVariants وSKU وربط المورد", href: "/merchant/ai-product-blueprint", icon: Boxes, color: "from-indigo-700 to-violet-500", badge: "AI Catalog" },
      { title: "الأصناف والخصائص", desc: "تصنيفات وخصائص ديناميكية بدون تعديل كود", href: "/merchant/product-taxonomy", icon: Tags, color: "from-pink-500 to-rose-500" },
      { title: "العملات والتسعير", desc: "عملات متعددة وأسعار صرف للمتجر", href: "/merchant/currencies", icon: WalletCards, color: "from-sky-500 to-blue-500" }
    ]
  },
  {
    title: "التسويق وإدارة الثقة",
    subtitle: "كل ما يرفع انطباع المتجر ويزيد تفاعل العملاء.",
    items: [
      { title: "المساعد الذكي", desc: "تحليل مبيعات ومخزون وتوصيات AI", href: "/merchant/ai-assistant", icon: Bot, color: "from-blue-700 to-violet-600", badge: "AI" },
      { title: "مركز ذكاء التاجر", desc: "مهام ذكية واقتراحات تحتاج موافقتك قبل التنفيذ", href: "/merchant/ai-workbench", icon: Bot, color: "from-violet-700 to-fuchsia-500", badge: "AI Workbench" },
      { title: "منصة الإعلانات", desc: "حملات ممولة وقياس CTR/CPC/ROAS", href: "/merchant/ads", icon: Megaphone, color: "from-purple-600 to-indigo-500", badge: "Ads" },
      { title: "إعلانات وأخبار المتجر", desc: "نشرات، تنبيهات، ورسائل تظهر داخل صفحة المتجر", href: "/merchant/announcements", icon: Megaphone, color: "from-purple-600 to-indigo-500" },
      { title: "العروض الموسمية", desc: "رفع عروض مرتبطة بمنتجات فعلية للمراجعة", href: "/merchant/offers", icon: Sparkles, color: "from-orange-500 to-red-500", badge: "تسويق" },
      { title: "الإعداد الذكي للمتجر", desc: "تصميم وأقسام وبانرات ومنتجات تجريبية بنقرة", href: "/merchant/smart-setup", icon: Wand2, color: "from-emerald-600 to-cyan-500", badge: "AI Setup" },
      { title: "إطلاق المتجر للعامة", desc: "Checklist الجاهزية قبل ظهور المتجر للعملاء", href: "/merchant/launch-readiness", icon: CheckCircle2, color: "from-blue-700 to-indigo-500", badge: "Launch" },
      { title: "المحلات والفروع", desc: "إدارة فروع النشاط نفسه في مدن مختلفة تحت المجموعة التجارية", href: "/merchant/branches", icon: Store, color: "from-emerald-700 to-teal-500", badge: "Branches" },
      { title: "إضافة نشاط مستقل", desc: "متجر جديد بعقد وكتالوج وموقع وفوترة مستقلة تحت حسابك الحالي", href: "/merchant/add-store", icon: Store, color: "from-violet-700 to-fuchsia-500", badge: "Multi-Store" },
      { title: "وسائط المتجر", desc: "شعار، غلاف، معرض، وفيديو تعريفي", href: "/merchant/media", icon: Image, color: "from-cyan-500 to-blue-500" },
      { title: "الموظفون والصلاحيات", desc: "فرق عمل بحسابات رسمية وصلاحيات محددة", href: "/merchant/employees", icon: Users, color: "from-slate-800 to-slate-500" },
      { title: "بيانات المتجر المحمية", desc: "طلب تعديل الاسم التجاري أو البريد عبر ملحق عقد", href: "/merchant/identity-change-requests", icon: ShieldCheck, color: "from-amber-600 to-orange-500", badge: "Contract" },
      { title: "الدفع والشحن", desc: "طرق دفع، شحن، وسياسات تشغيل الطلبات", href: "/merchant/operations-settings", icon: Settings, color: "from-lime-500 to-emerald-500", badge: "جاهزية" },
      { title: "ربط النظام المحاسبي", desc: "طلب ربط أي ERP، متابعة Agent وMapping والشهادة", href: "/merchant/integrations", icon: Settings, color: "from-blue-700 to-cyan-500", badge: "ERP" },
      { title: "إيجار المتجر والإضافات", desc: "اتفاق الإيجار، الفواتير، والإضافات المدفوعة", href: "/merchant/billing", icon: ReceiptText, color: "from-emerald-700 to-teal-500", badge: "Billing" },
      { title: "إيرادات المنصة", desc: "تقرير مبيعات، عمولة، إيجار وإعلانات في كشف موحد", href: "/merchant/platform-revenue", icon: ReceiptText, color: "from-indigo-700 to-violet-500", badge: "Revenue" },
      { title: "العقد والاعتماد", desc: "حالة العقد، التنبيهات، وطلب التجديد", href: "/merchant/onboarding", icon: FileText, color: "from-blue-800 to-indigo-700" }
    ]
  }
];

const storeStatusLabels: Record<string, string> = {
  active: "نشط",
  pending: "بانتظار التفعيل",
  suspended: "موقوف",
  closed: "مغلق",
  frozen: "مجمّد"
};

const contractStatusLabels: Record<string, string> = {
  draft: "مسودة",
  pending_signature: "بانتظار التوقيع",
  pending_approval: "بانتظار الاعتماد",
  active: "نشط",
  near_expiry: "قرب الانتهاء",
  expired: "منتهي",
  grace: "مهلة سماح",
  renewal_requested: "طلب تجديد",
  frozen: "مجمّد",
  terminated: "منهى",
  renewed: "مجدّد"
};

const productStatusLabels: Record<string, string> = {
  active: "نشط",
  draft: "مسودة",
  inactive: "غير نشط",
  archived: "مؤرشف"
};

const orderStatusLabels: Record<string, string> = {
  new: "جديد",
  pending: "بانتظار",
  confirmed: "مؤكد",
  processing: "قيد التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  completed: "مكتمل",
  returned: "مرتجع"
};

export function MerchantDashboardPro({ data }: { data: DashboardData }) {
  const {
    store,
    metrics,
    recentOrders,
    lowStock,
    topProducts,
    contract,
    contractRemainingDays,
    storeHealth,
    readiness,
    salesTrend,
    orderStatusBreakdown,
    productStatusBreakdown,
    recentNotifications,
    operationalAlerts,
    dailyWorkQueue,
    quickWins,
    availableStores,
    portfolio,
    financial
  } = data;

  if (!store) return <NoStoreState />;

  const avgOrderValue = metrics.orders > 0 ? metrics.salesTotal / metrics.orders : 0;
  const activeProductPercent = metrics.products > 0 ? Math.round((metrics.activeProducts / metrics.products) * 100) : 0;
  const stockHealthPercent = metrics.variants > 0 ? Math.max(0, Math.round(((metrics.variants - metrics.lowStock) / metrics.variants) * 100)) : 100;
  const heroMetrics = [
    { title: "مبيعات اليوم", value: formatCurrency(metrics.todaySales), helper: `${formatNumber(metrics.todayOrders)} طلب اليوم`, icon: CircleDollarSign },
    { title: "مبيعات الشهر", value: formatCurrency(metrics.monthSales), helper: `${formatNumber(metrics.monthOrders)} طلب هذا الشهر`, icon: LineChart },
    { title: "طلبات جديدة", value: formatNumber(metrics.newOrders), helper: "تحتاج متابعة سريعة", icon: BellRing },
    { title: "جاهزية المتجر", value: `${formatNumber(readiness.score)}%`, helper: `${formatNumber(readiness.completed)} من ${formatNumber(readiness.total)} مكتملة`, icon: Gauge }
  ];

  return (
    <div className="space-y-8">
      <MerchantHero store={store} readinessScore={readiness.score} heroMetrics={heroMetrics} stores={availableStores} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard title="إجمالي المبيعات" value={formatCurrency(metrics.salesTotal)} helper={`متوسط الطلب ${formatCurrency(avgOrderValue)}`} icon={CircleDollarSign} tone="blue" className="xl:col-span-2" />
        <KpiCard title="طلبات قيد التشغيل" value={formatNumber(metrics.inProgressOrders)} helper={`${formatNumber(metrics.pendingPayments)} مدفوعات معلقة`} icon={ShoppingBag} tone="amber" />
        <KpiCard title="المنتجات النشطة" value={`${formatNumber(metrics.activeProducts)} / ${formatNumber(metrics.products)}`} helper={`${formatNumber(activeProductPercent)}% جاهزة للبيع`} icon={PackageCheck} tone="emerald" />
        <KpiCard title="قيمة المخزون" value={formatCurrency(metrics.inventoryValue)} helper={`${formatNumber(metrics.availableStock)} قطعة متاحة`} icon={Boxes} tone="violet" />
        <KpiCard title="تقييم العملاء" value={metrics.reviews > 0 ? metrics.ratingAverage.toFixed(1) : "-"} helper={`${formatNumber(metrics.reviews)} تقييم`} icon={Star} tone="rose" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <PortfolioSnapshot stores={availableStores} selectedStoreId={store.id} portfolio={portfolio} />
        <FinancialSnapshot financial={financial} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,.9fr)]">
        <div className="space-y-6">
          <ExecutiveStrip metrics={metrics} activeProductPercent={activeProductPercent} stockHealthPercent={stockHealthPercent} />
          <SalesTrendCard data={salesTrend} />
          <section className="grid gap-6 lg:grid-cols-2">
            <BreakdownCard title="توزيع حالات الطلبات" description="يساعدك على معرفة عنق الزجاجة في دورة الطلب." rows={orderStatusBreakdown.map((item) => ({ label: orderStatusLabels[item.status] || item.status, value: item.count, meta: formatCurrency(item.total) }))} emptyText="لا توجد طلبات بعد" tone="blue" />
            <BreakdownCard title="حالة الكتالوج" description="نسبة المنتجات الجاهزة للبيع مقابل المسودات." rows={productStatusBreakdown.map((item) => ({ label: productStatusLabels[item.status] || item.status, value: item.count }))} emptyText="لا توجد منتجات بعد" tone="emerald" />
          </section>
          <ActionHub groups={actionGroups} />
          <section className="grid gap-6 xl:grid-cols-2">
            <RecentOrdersPanel store={store} items={recentOrders} />
            <LowStockPanel store={store} items={lowStock} />
          </section>
        </div>

        <aside className="space-y-6">
          <ReadinessCard score={readiness.score} completed={readiness.completed} total={readiness.total} items={storeHealth} quickWins={quickWins} />
          <DailyWorkQueueCard tasks={dailyWorkQueue} />
          <AlertsCard alerts={operationalAlerts} />
          <ContractCard contract={contract} remainingDays={contractRemainingDays} />
          <NotificationsCard items={recentNotifications} unreadCount={metrics.unreadNotifications} />
        </aside>
      </section>
    </div>
  );
}

function NoStoreState() {
  const steps = [
    "قدّم طلب فتح متجر من الواجهة الرسمية.",
    "استكمل البيانات والوثائق المطلوبة.",
    "وقّع العقد الإلكتروني وانتظر الاعتماد النهائي.",
    "بعد الاعتماد ستظهر لوحة العمليات الاحترافية هنا تلقائياً."
  ];

  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-card backdrop-blur-xl">
      <div className="grid gap-0 lg:grid-cols-[1.2fr_.8fr]">
        <div className="p-8 md:p-10">
          <Badge className="mb-5 bg-blue-50 text-blue-700">مركز التاجر</Badge>
          <h2 className="text-3xl font-black text-slate-950 md:text-5xl">لا يوجد متجر مرتبط بحسابك حالياً</h2>
          <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-600 md:text-base">بعد اعتماد طلب فتح المتجر سيظهر لك مركز تشغيل احترافي يتضمن الطلبات، المخزون، المنتجات، التسويق، العقد، والصلاحيات.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href="/apply-store"><Store className="h-5 w-5" /> طلب فتح متجر</Link></Button>
            <Button asChild variant="outline" size="lg"><Link href="/merchant/onboarding">متابعة طلب سابق</Link></Button>
          </div>
        </div>
        <div className="border-t bg-slate-950 p-8 text-white lg:border-r lg:border-t-0">
          <h3 className="text-xl font-black">رحلة تجهيز المتجر</h3>
          <div className="mt-6 space-y-4">
            {steps.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-2xl bg-white/10 p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-sm font-black text-slate-950">{index + 1}</span>
                <p className="text-sm leading-7 text-white/75">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MerchantHero({ store, readinessScore, heroMetrics, stores }: { store: DashboardStore; readinessScore: number; heroMetrics: Array<{ title: string; value: string; helper: string; icon: LucideIcon }>; stores: DashboardData["availableStores"] }) {
  return (
    <section className="merchant-workspace-hero relative overflow-hidden rounded-[2.2rem] border border-white/70 bg-slate-950 p-5 text-white shadow-soft md:p-8">
      {store.coverImageUrl ? <img src={store.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" /> : null}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(16,185,129,.28),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,.25),transparent_30%),linear-gradient(120deg,rgba(2,6,23,.98),rgba(15,23,42,.9),rgba(30,41,59,.75))]" />
      <div className="relative space-y-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 flex-col gap-5 md:flex-row md:items-center">
            <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-[1.7rem] border-4 border-white/15 bg-white text-slate-950 shadow-2xl">
              {store.logoUrl ? <img src={store.logoUrl} alt={store.name} className="h-full w-full object-cover" /> : <Store className="h-10 w-10" />}
            </div>
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="bg-white/10 text-white ring-1 ring-white/15">{store.storeNumber}</Badge>
                <Badge className={cn("text-white", store.status === "active" ? "bg-emerald-500" : "bg-amber-500")}>{storeStatusLabels[store.status] || store.status}</Badge>
                <Badge className="bg-white/10 text-white ring-1 ring-white/15">جاهزية {formatNumber(readinessScore)}%</Badge>
              </div>
              <h1 className="truncate text-3xl font-black md:text-5xl">{store.name}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-8 text-white/70">{store.description || "أكمل وصف المتجر ليظهر بشكل احترافي للعملاء ويعطيهم ثقة أعلى قبل الشراء."}</p>
            </div>
          </div>

          <div className="space-y-3">
            <MerchantStoreSwitcher stores={stores} selectedStoreId={store.id} />
            <StoreLinkActions slug={store.slug} />
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white"><Link href="/merchant/products"><PackagePlus className="h-4 w-4" /> إضافة منتج</Link></Button>
              <Button asChild variant="ghost" className="text-white hover:bg-white/10 hover:text-white"><Link href="/merchant/settings"><Settings className="h-4 w-4" /> إعدادات المتجر</Link></Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {heroMetrics.map((metric) => (
            <div key={metric.title} className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-white/50">{metric.title}</p>
                  <p className="mt-2 text-2xl font-black">{metric.value}</p>
                  <p className="mt-1 text-xs text-white/55">{metric.helper}</p>
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-950"><metric.icon className="h-5 w-5" /></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function KpiCard({ title, value, helper, icon: Icon, tone, className }: { title: string; value: string; helper: string; icon: LucideIcon; tone: "blue" | "amber" | "emerald" | "violet" | "rose"; className?: string }) {
  const toneClasses = {
    blue: { bar: "from-blue-600 to-cyan-400", icon: "bg-blue-50 text-blue-600" },
    amber: { bar: "from-amber-500 to-orange-500", icon: "bg-amber-50 text-amber-600" },
    emerald: { bar: "from-emerald-600 to-teal-400", icon: "bg-emerald-50 text-emerald-600" },
    violet: { bar: "from-violet-600 to-fuchsia-500", icon: "bg-violet-50 text-violet-600" },
    rose: { bar: "from-rose-600 to-pink-500", icon: "bg-rose-50 text-rose-600" }
  }[tone];

  return (
    <Card className={cn("merchant-kpi-card overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-500">{title}</p>
            <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
            <p className="mt-2 text-xs font-bold text-slate-400">{helper}</p>
          </div>
          <div className={cn("grid h-12 w-12 place-items-center rounded-2xl", toneClasses.icon)}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
        <div className={cn("mt-5 h-1.5 rounded-full bg-gradient-to-l", toneClasses.bar)} />
      </CardContent>
    </Card>
  );
}

function PortfolioSnapshot({ stores, selectedStoreId, portfolio }: { stores: DashboardData["availableStores"]; selectedStoreId: string; portfolio: DashboardData["portfolio"] }) {
  return <Card><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="flex items-center gap-2"><Store className="h-5 w-5 text-emerald-600"/> محفظة المتاجر</CardTitle><Button asChild size="sm" variant="outline"><Link href="/merchant/branches">إدارة المحلات</Link></Button></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-3"><InfoTile label="المتاجر/الفروع" value={formatNumber(portfolio.storeCount)} /><InfoTile label="متاجر نشطة" value={formatNumber(portfolio.activeStoreCount)} /><InfoTile label="مبيعات مخزنة" value={formatCurrency(portfolio.totalSales)} /></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{stores.map((item) => <Link key={item.id} href={item.id === selectedStoreId ? "#merchant-dashboard" : "/merchant/branches"} className={cn("min-w-44 rounded-2xl border p-3 text-right text-sm transition", item.id === selectedStoreId ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-600 hover:border-blue-200")}><p className="font-black">{item.name}</p><p className="mt-1 text-xs font-bold opacity-70">{item.storeNumber} · {storeStatusLabels[item.status] || item.status}</p></Link>)}</div></CardContent></Card>;
}

function FinancialSnapshot({ financial }: { financial: DashboardData["financial"] }) {
  const due = financial.nextDueAt ? formatDate(financial.nextDueAt) : "لا يوجد استحقاق قريب";
  return <Card><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-violet-600"/> الالتزامات وإيرادات المنصة</CardTitle><Button asChild size="sm" variant="outline"><Link href="/merchant/platform-revenue">فتح الكشوف</Link></Button></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-3"><InfoTile label="استحقاق المتجر النشط" value={currencySummary(financial.currentOutstandingByCurrency)} /><InfoTile label="إجمالي المحفظة" value={currencySummary(financial.portfolioOutstandingByCurrency)} /><InfoTile label="كشوف مفتوحة" value={formatNumber(financial.openStatements)} /></div><div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm font-bold text-violet-900">موعد الاستحقاق الأقرب: {due}. هذه التزامات المنصة فقط ولا تمثل أموال مبيعات العملاء.</div></CardContent></Card>;
}

function ExecutiveStrip({ metrics, activeProductPercent, stockHealthPercent }: { metrics: DashboardData["metrics"]; activeProductPercent: number; stockHealthPercent: number }) {
  const chips = [
    { label: "طرق الدفع", value: metrics.activePaymentMethods, suffix: "مفعلة", icon: CreditCard },
    { label: "طرق الشحن", value: metrics.activeShippingMethods, suffix: "مفعلة", icon: Truck },
    { label: "العروض النشطة", value: metrics.activeOffers, suffix: "عرض", icon: Sparkles },
    { label: "رسائل غير مقروءة", value: metrics.unreadNotifications, suffix: "تنبيه", icon: BellRing }
  ];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 md:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white"><LayoutDashboard className="h-6 w-6" /></span>
              <div>
                <h2 className="text-xl font-black text-slate-950">مركز القيادة التشغيلي</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">ملخص سريع لما يحتاجه التاجر لاتخاذ قرار يومي بدون البحث داخل الصفحات.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ProgressInsight title="جاهزية المنتجات" value={activeProductPercent} helper={`${formatNumber(metrics.activeProducts)} منتج نشط من ${formatNumber(metrics.products)}`} />
              <ProgressInsight title="صحة المخزون" value={stockHealthPercent} helper={`${formatNumber(metrics.lowStock)} متغير قرب النفاد`} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {chips.map((chip) => (
              <div key={chip.label} className="rounded-3xl border bg-slate-50/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-slate-500">{chip.label}</p>
                  <chip.icon className="h-5 w-5 text-blue-500" />
                </div>
                <p className="mt-2 text-2xl font-black text-slate-950">{formatNumber(chip.value)}</p>
                <p className="text-xs text-slate-400">{chip.suffix}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressInsight({ title, value, helper }: { title: string; value: number; helper: string }) {
  return (
    <div className="rounded-3xl border bg-white/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-black text-slate-800">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{helper}</p>
        </div>
        <span className="text-lg font-black text-blue-600">{formatNumber(value)}%</span>
      </div>
      <div className="mt-4 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-gradient-to-l from-blue-600 to-cyan-400" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function SalesTrendCard({ data }: { data: DashboardData["salesTrend"] }) {
  const maxSales = Math.max(...data.map((item) => item.sales), 1);
  const maxOrders = Math.max(...data.map((item) => item.orders), 1);
  const totalSales = data.reduce((sum, item) => sum + item.sales, 0);
  const totalOrders = data.reduce((sum, item) => sum + item.orders, 0);

  return (
    <Card>
      <CardHeader className="flex-col gap-4 md:flex-row md:items-start md:justify-between md:space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-blue-600" /> نبض المبيعات آخر 14 يوم</CardTitle>
          <p className="mt-2 text-sm text-slate-500">رسم سريع للمبيعات والطلبات يساعد التاجر على قراءة النشاط اليومي.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{formatCurrency(totalSales)} مبيعات</Badge>
          <Badge variant="outline">{formatNumber(totalOrders)} طلب</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {data.length ? (
          <div className="rounded-3xl border bg-gradient-to-b from-slate-50 to-white p-4">
            <div className="flex h-72 items-end gap-2 md:gap-3">
              {data.map((item) => (
                <div key={item.key} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-56 w-full items-end justify-center gap-1 rounded-2xl bg-white/70 px-1 py-2 shadow-sm transition group-hover:bg-blue-50">
                    <div className="w-1/2 rounded-t-xl bg-gradient-to-t from-blue-700 to-cyan-400" title={`مبيعات ${formatCurrency(item.sales)}`} style={{ height: `${Math.max(6, (item.sales / maxSales) * 200)}px` }} />
                    <div className="w-1/3 rounded-t-xl bg-gradient-to-t from-amber-500 to-orange-300" title={`طلبات ${formatNumber(item.orders)}`} style={{ height: `${Math.max(6, (item.orders / maxOrders) * 160)}px` }} />
                  </div>
                  <div className="w-full truncate text-center text-[11px] font-bold text-slate-500">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-slate-500">
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> المبيعات</span>
              <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> الطلبات</span>
            </div>
          </div>
        ) : (
          <EmptyInline title="لا توجد بيانات مبيعات بعد" description="عند وصول أول طلب سيظهر الرسم البياني تلقائياً." />
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownCard({ title, description, rows, emptyText, tone }: { title: string; description: string; rows: Array<{ label: string; value: number; meta?: string }>; emptyText: string; tone: "blue" | "emerald" }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const barClass = tone === "blue" ? "from-blue-600 to-cyan-400" : "from-emerald-600 to-teal-400";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm leading-6 text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length ? rows.map((row) => {
          const percent = total > 0 ? Math.round((row.value / total) * 100) : 0;
          return (
            <div key={row.label} className="rounded-2xl border bg-slate-50/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-slate-800">{row.label}</p>
                  {row.meta ? <p className="mt-1 text-xs text-slate-500">{row.meta}</p> : null}
                </div>
                <span className="text-xl font-black text-slate-950">{formatNumber(row.value)}</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white">
                <div className={cn("h-2 rounded-full bg-gradient-to-l", barClass)} style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        }) : <EmptyInline title={emptyText} description="ستظهر البيانات هنا تلقائياً بعد بدء النشاط." />}
      </CardContent>
    </Card>
  );
}

function ActionHub({ groups }: { groups: typeof actionGroups }) {
  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-950">مركز الأدوات المرن</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">كل قسم مصمم كأداة مستقلة يمكن تطويرها مستقبلاً بدون التأثير على بقية اللوحة.</p>
        </div>
        <Badge variant="outline">لوحة Enterprise</Badge>
      </div>
      {groups.slice(0, 2).map((group) => <ActionGroup key={group.title} group={group} />)}
      {groups.slice(2).map((group) => <details key={group.title} className="group rounded-[2rem] border border-white/70 bg-white/75 p-4 shadow-card backdrop-blur-xl md:p-5"><summary className="cursor-pointer list-none"><div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-black text-slate-950">{group.title}</h3><p className="mt-1 text-xs leading-6 text-slate-500">{group.subtitle}</p></div><Badge variant="outline">أدوات متقدمة</Badge></div></summary><div className="mt-5"><ActionGroup group={group} compact /></div></details>)}
    </section>
  );
}

function ActionGroup({ group, compact = false }: { group: (typeof actionGroups)[number]; compact?: boolean }) {
  return (
    <div className={cn("rounded-[2rem] border border-white/70 bg-white/75 p-4 shadow-card backdrop-blur-xl md:p-5", compact && "border-0 bg-transparent p-0 shadow-none")}>
      <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-950">{group.title}</h3>
          <p className="mt-1 text-xs leading-6 text-slate-500">{group.subtitle}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {group.items.map((item) => (
          <Link key={item.href} href={item.href} className="group relative overflow-hidden rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-soft">
            <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-l", item.color)} />
            <div className="flex items-start justify-between gap-4">
              <div className={cn("grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg", item.color)}><item.icon className="h-6 w-6" /></div>
              {item.badge ? <Badge variant="outline">{item.badge}</Badge> : null}
            </div>
            <h4 className="mt-4 font-black text-slate-950">{item.title}</h4>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{item.desc}</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-primary">فتح الأداة <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" /></span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ReadinessCard({ score, completed, total, items, quickWins }: { score: number; completed: number; total: number; items: HealthItem[]; quickWins: DashboardData["quickWins"] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-l from-slate-950 to-slate-800 text-white">
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> جاهزية البيع والثقة</CardTitle>
        <p className="text-sm leading-6 text-white/60">مؤشر عملي لما يجب إكماله قبل التوسع في التسويق.</p>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="flex items-center gap-5">
          <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full p-2" style={{ background: `conic-gradient(#10b981 ${score * 3.6}deg, #e2e8f0 0deg)` }}>
            <div className="grid h-full w-full place-items-center rounded-full bg-white text-center shadow-inner">
              <span className="text-2xl font-black text-slate-950">{formatNumber(score)}%</span>
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-slate-950">{formatNumber(completed)} / {formatNumber(total)} عناصر مكتملة</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">كلما ارتفعت الجاهزية زادت ثقة العملاء وسهولة اعتماد الحملات.</p>
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item) => <HealthRow key={item.key} item={item} />)}
        </div>

        {quickWins.length ? (
          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-4">
            <p className="mb-3 flex items-center gap-2 font-black text-amber-900"><Wand2 className="h-5 w-5" /> إجراءات مقترحة الآن</p>
            <div className="space-y-2">
              {quickWins.slice(0, 3).map((item) => (
                <Link key={item.title} href={item.href} className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 p-3 text-sm font-bold text-slate-700 transition hover:bg-white">
                  <span>{item.title}</span>
                  <ArrowLeft className="h-4 w-4 text-amber-600" />
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function HealthRow({ item }: { item: HealthItem }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border bg-slate-50/80 p-3">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-9 w-9 place-items-center rounded-xl", item.ok ? "bg-emerald-100 text-emerald-600" : item.severity === "high" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600")}>{item.ok ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}</span>
        <div>
          <p className="font-black text-slate-800">{item.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{item.hint}</p>
        </div>
      </div>
      {!item.ok ? <Button asChild size="sm" variant="outline" className="hidden shrink-0 md:inline-flex"><Link href={item.actionHref}>{item.actionLabel}</Link></Button> : null}
    </div>
  );
}

function DailyWorkQueueCard({ tasks }: { tasks: DashboardData["dailyWorkQueue"] }) {
  return <Card><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-blue-600" /> قائمة عمل اليوم</CardTitle><Badge variant={tasks.length ? "warning" : "success"}>{tasks.length ? `${formatNumber(tasks.length)} مهام` : "مكتمل"}</Badge></CardHeader><CardContent className="space-y-3">{tasks.length ? tasks.map((task) => <Link key={task.key} href={task.href} className="flex items-center justify-between gap-3 rounded-2xl border bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-blue-50"><div className="flex min-w-0 items-center gap-3"><span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl font-black", task.priority === "critical" ? "bg-red-100 text-red-700" : task.priority === "high" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700")}>{formatNumber(task.count)}</span><div><p className="font-black text-slate-900">{task.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{task.description}</p></div></div><ArrowLeft className="h-4 w-4 shrink-0 text-primary" /></Link>) : <EmptyInline title="لا توجد مهام تشغيلية عاجلة" description="تابع الطلبات الجديدة أو حسّن كتالوجك وعروضك لزيادة المبيعات." icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />} />}</CardContent></Card>;
}

function AlertsCard({ alerts }: { alerts: AlertItem[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5 text-amber-500" /> التنبيهات التشغيلية</CardTitle>
        <Badge variant={alerts.length ? "warning" : "success"}>{alerts.length ? formatNumber(alerts.length) : "مستقر"}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.length ? alerts.map((alert) => <AlertRow key={`${alert.title}-${alert.href}`} alert={alert} />) : <EmptyInline title="لا توجد تنبيهات حرجة" description="المتجر مستقر حالياً. استمر في متابعة الطلبات والمخزون." icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />} />}
      </CardContent>
    </Card>
  );
}

function AlertRow({ alert }: { alert: AlertItem }) {
  const classes = {
    danger: "border-red-100 bg-red-50 text-red-700",
    warning: "border-amber-100 bg-amber-50 text-amber-700",
    info: "border-blue-100 bg-blue-50 text-blue-700",
    success: "border-emerald-100 bg-emerald-50 text-emerald-700"
  }[alert.severity];

  return (
    <Link href={alert.href} className={cn("block rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm", classes)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-black">{alert.title}</p>
          <p className="mt-1 text-xs leading-5 opacity-80">{alert.description}</p>
        </div>
      </div>
    </Link>
  );
}

function ContractCard({ contract, remainingDays }: { contract: DashboardData["contract"]; remainingDays: number | null }) {
  const safeRemaining = remainingDays === null ? null : Math.max(0, remainingDays);
  const progress = safeRemaining === null ? 0 : Math.max(0, Math.min(100, Math.round((safeRemaining / 365) * 100)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-blue-600" /> العقد والاعتماد</CardTitle>
      </CardHeader>
      <CardContent>
        {contract ? (
          <div className="space-y-4">
            <div className="rounded-3xl border bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">رقم العقد</p>
              <p className="mt-1 text-lg font-black text-slate-950">{contract.contractNumber}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">{contractStatusLabels[contract.status] || contract.status}</Badge>
                <Badge variant={remainingDays !== null && remainingDays <= 30 ? "warning" : "success"}>{remainingDays === null ? "غير محدد" : `${formatNumber(remainingDays)} يوم متبقي`}</Badge>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoTile label="بداية العقد" value={formatDate(contract.startAt)} />
              <InfoTile label="نهاية العقد" value={formatDate(contract.endAt)} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500"><span>مؤشر المدة المتبقية</span><span>{formatNumber(progress)}%</span></div>
              <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-gradient-to-l from-emerald-600 to-teal-400" style={{ width: `${progress}%` }} /></div>
            </div>
            <Button asChild variant="outline" className="w-full"><Link href="/merchant/onboarding">إدارة العقد وطلب التجديد</Link></Button>
          </div>
        ) : (
          <EmptyInline title="لا يوجد عقد مرتبط" description="سيظهر العقد هنا بعد اعتماد الإدارة أو إنشاء العقد النهائي." />
        )}
      </CardContent>
    </Card>
  );
}

function NotificationsCard({ items, unreadCount }: { items: DashboardData["recentNotifications"]; unreadCount: number }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-slate-600" /> آخر الإشعارات</CardTitle>
        <Badge variant={unreadCount ? "warning" : "outline"}>{formatNumber(unreadCount)} غير مقروء</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? items.map((item) => (
          <div key={item.id} className="rounded-2xl border bg-slate-50/80 p-3">
            <p className="font-black text-slate-800">{item.title}</p>
            {item.body ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.body}</p> : null}
            <p className="mt-2 text-[11px] font-bold text-slate-400">{formatDate(item.createdAt)}</p>
          </div>
        )) : <EmptyInline title="لا توجد إشعارات" description="ستظهر تحديثات الإدارة والطلبات هنا." />}
      </CardContent>
    </Card>
  );
}

function RecentOrdersPanel({ items }: { store: DashboardStore; items: DashboardData["recentOrders"] }) {
  return (
    <PanelShell title="أحدث الطلبات" href="/merchant/orders" icon={<ShoppingBag className="h-5 w-5" />}>
      {items.length ? items.map((order) => (
        <div key={order.id} className="rounded-2xl bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-black text-slate-900">{order.orderNumber}</p>
            <Badge variant="outline">{orderStatusLabels[order.statusCode] || order.statusCode}</Badge>
          </div>
          <p className="mt-1 text-sm font-black text-primary">{formatCurrency(order.grandTotal, order.currency)}</p>
          <p className="mt-1 text-xs text-slate-400">{formatDate(order.createdAt)}</p>
        </div>
      )) : <EmptyInline title="لا توجد طلبات" description="ستظهر أحدث الطلبات بمجرد بدء البيع." />}
    </PanelShell>
  );
}

function LowStockPanel({ store, items }: { store: DashboardStore; items: DashboardData["lowStock"] }) {
  return (
    <PanelShell title="مخزون منخفض" href="/merchant/inventory" icon={<Boxes className="h-5 w-5" />}>
      {items.length ? items.map((item) => (
        <Link key={item.variantId} href={`/store/${store.slug}/products/${item.productSlug}?preview=1`} className="flex gap-3 rounded-2xl bg-amber-50 p-3 transition hover:bg-amber-100">
          <Thumb src={item.imageUrl || item.productImageUrl} alt={item.productName} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-black text-slate-900">{item.productName}</p>
            <p className="mt-1 text-xs text-slate-500">{item.title || item.sku}</p>
            <p className="mt-1 text-xs font-black text-amber-700">{formatNumber(item.stockQuantity)} متبقي / حد {formatNumber(item.lowStockThreshold)}</p>
          </div>
        </Link>
      )) : <EmptyInline title="المخزون مستقر" description="لا توجد منتجات وصلت إلى حد التنبيه." icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />} />}
    </PanelShell>
  );
}

function TopProductsPanel({ store, items }: { store: DashboardStore; items: DashboardData["topProducts"] }) {
  return (
    <PanelShell title="أفضل المنتجات" href="/merchant/products" icon={<Package className="h-5 w-5" />}>
      {items.length ? items.map((product) => (
        <Link key={product.id} href={`/store/${store.slug}/products/${product.slug}?preview=1`} className="flex gap-3 rounded-2xl bg-slate-50 p-3 transition hover:bg-blue-50">
          <Thumb src={product.mainImageUrl} alt={product.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-black text-slate-900">{product.name}</p>
            <p className="mt-1 text-xs text-slate-500">{formatNumber(product.soldCount)} مبيع · {formatNumber(product.viewCount)} مشاهدة</p>
            <Badge variant={product.status === "active" ? "success" : "outline"} className="mt-2">{productStatusLabels[product.status] || product.status}</Badge>
          </div>
        </Link>
      )) : <EmptyInline title="لا توجد منتجات" description="أضف منتجات ليظهر ترتيب الأداء هنا." />}
    </PanelShell>
  );
}

function PanelShell({ title, href, icon, children }: { title: string; href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">{icon} {title}</CardTitle>
        <Button asChild size="sm" variant="outline"><Link href={href}>فتح</Link></Button>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function currencySummary(values: Record<string, number>) { const rows = Object.entries(values); return rows.length ? rows.map(([currency, amount]) => formatCurrency(amount, currency)).join(" · ") : "—"; }

function InfoTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 font-black text-slate-950">{value}</p></div>;
}

function Thumb({ src, alt }: { src?: string | null; alt: string }) {
  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white text-slate-300 shadow-sm">
      {src ? <img src={src} alt={alt} className="h-full w-full object-cover" /> : <Package className="h-6 w-6" />}
    </div>
  );
}

function EmptyInline({ title, description, icon }: { title: string; description: string; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed bg-slate-50/80 p-5 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-300 shadow-sm">{icon || <Sparkles className="h-7 w-7" />}</div>
      <p className="font-black text-slate-800">{title}</p>
      <p className="mt-1 text-xs leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function formatDate(input?: Date | string | null) {
  if (!input) return "-";
  return new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(new Date(input));
}
