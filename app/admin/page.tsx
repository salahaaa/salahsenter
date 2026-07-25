import Link from "next/link";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Building2,
  CreditCard,
  DatabaseBackup,
  ClipboardList,
  FileText,
  Globe2,
  Home,
  Images,
  Layers3,
  Megaphone,
  Package,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Users
} from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModuleCard } from "@/components/admin/module-card";
import { getAdminDashboardStats, hasDatabase } from "@/lib/db/queries";
import { adCampaigns, db, merchantApplications, storeOfferCollections, users } from "@/lib/db";
import { and, inArray, eq, sql } from "drizzle-orm";
import { formatNumber } from "@/lib/utils";
import { requireAuth } from "@/lib/auth";
import { assertAdmin, getUserPermissions } from "@/lib/rbac";

const modulePermissionByHref: Record<string, string> = {
  "/admin/command-center": "reports.view",
  "/admin/work-queue": "admin.access",
  "/admin/observability": "reports.view",
  "/admin/ai-tools": "admin.access",
  "/admin/scaling": "security.manage",
  "/admin/integrations": "security.manage",
  "/admin/integrations/reconciliation": "security.manage",
  "/admin/security": "security.manage",
  "/admin/sensitive-control": "security.manage",
  "/admin/release-gates": "security.manage",
  "/admin/test-control": "security.manage",
  "/admin/master": "master.manage",
  "/admin/theme-builder": "theme.manage",
  "/admin/home-builder": "home.manage",
  "/admin/home-visibility": "home.manage",
  "/admin/home-exposure-revenue": "ads.manage",
  "/admin/cms": "cms.manage",
  "/admin/menu": "home.manage",
  "/admin/contracts": "contracts.manage",
  "/admin/rentals": "contracts.manage",
  "/admin/platform-revenue": "platform_revenue.statements.view",
  "/admin/commissions-taxes": "commissions.manage",
  "/admin/financial-providers": "payments.manage",
  "/admin/notifications-center": "notifications.manage",
  "/admin/rbac-builder": "roles.manage",
  "/admin/wings": "wings.manage",
  "/admin/merchant-applications": "merchant_applications.manage",
  "/admin/store-launch-readiness": "merchant_applications.launch.review",
  "/admin/identity-change-requests": "stores.identity_changes.review",
  "/admin/stores": "stores.manage",
  "/admin/settings": "admin.settings.manage",
  "/admin/text-center": "admin.settings.manage",
  "/admin/ads": "ads.manage",
  "/admin/offers": "offers.manage",
  "/admin/news": "news.manage",
  "/admin/geography": "geography.manage",
  "/admin/roles": "roles.manage",
  "/admin/employees": "employees.view",
  "/admin/permissions-management": "employees.permissions.manage",
  "/admin/users": "users.manage",
  "/admin/products": "products.manage",
  "/admin/activity-templates": "products.manage",
  "/admin/audit-log": "security.manage",
  "/admin/default-media": "default_media.manage",
  "/admin/subscriptions": "subscriptions.manage",
  "/admin/backups": "backups.manage",
  "/admin/reports": "reports.view"
};

const modules = [
  { title: "مركز قيادة المنصة", description: "مؤشرات تنفيذية ومهام عاجلة: طلبات التجار، عروض للمراجعة، عقود قريبة الانتهاء ومخزون منخفض.", href: "/admin/command-center", icon: BarChart3 },
  { title: "طابور عمل الإدارة", description: "توزيع مهام الاعتماد والتحصيل وERP والأمن على الموظفين مع SLA وحالة إنجاز موحدة.", href: "/admin/work-queue", icon: ClipboardList },
  { title: "Central Monitoring", description: "مراقبة لحظية للـ APIs والموارد وRedis وDB وQueue وUpload وIncident/Error Tracking.", href: "/admin/observability", icon: Activity },
  { title: "مركز إضافات الأدمن الذكية", description: "اختصارات كل أدوات AI الخاصة بالأدمن: تلخيص طلبات التجار، مراجعة الإعلانات، مراقبة المنصة والحماية.", href: "/admin/ai-tools", icon: Bot },
  { title: "Auto Scaling Intelligence", description: "توسيع وتقليل API وWorkers وRedis وLoad Balancing حسب الحمل مع Emergency/Predictive Scaling.", href: "/admin/scaling", icon: ServerCog },
  { title: "ERP Integration Infrastructure", description: "إدارة عملاء الربط، مفاتيح API، Mapping Profiles، Agents وEntity Links لكل متجر بدون DB-to-DB.", href: "/admin/integrations", icon: ServerCog },
  { title: "ERP Reconciliation", description: "مطابقة الحجوزات والفواتير وRetry/Failed Sync Queue وتعارضات المخزون بين المنصة وERP.", href: "/admin/integrations/reconciliation", icon: ServerCog },
  { title: "مركز حماية المنصة", description: "مراقبة ذكية لحظية، كشف أعطال وتهديدات، حوادث، تنبيهات وإصلاح ذاتي آمن.", href: "/admin/security", icon: ShieldAlert },
  { title: "مركز التحكم الحساس", description: "عمليات القفل والتصفية قبل الإطلاق وإدارة حسابي المالك. محمي بكلمة مرور حساسة مستقلة.", href: "/admin/sensitive-control", icon: ShieldAlert },
  { title: "بوابة الإطلاق", description: "دليل جاهزية الإنتاج، اختبارات Staging، استعادة النسخ والـ release evidence.", href: "/admin/release-gates", icon: ShieldCheck },
  { title: "مركز اختبارات الفريق", description: "حالات اختبار QA، الأدلة، الأعطال والحالات المحجوبة من حسابات الفريق الفردية.", href: "/admin/test-control", icon: ClipboardList },
  { title: "Master Administration", description: "العقل المركزي لإعدادات المنصة والمول والمتاجر والعقود والأمان والتقارير.", href: "/admin/master", icon: SlidersHorizontal },
  { title: "قواعد ظهور الرئيسية", description: "تحديد معايير المتاجر والمنتجات والأجنحة والعروض التي تظهر في الصفحة الرئيسية.", href: "/admin/home-visibility", icon: SlidersHorizontal },
  { title: "محرك ظهور وإيرادات الرئيسية", description: "إدارة المساحات التجارية المجدولة والتدوير العادل والحدود والإيراد الإعلاني بعيداً عن قواعد المحتوى العضوي.", href: "/admin/home-exposure-revenue", icon: Megaphone },
  { title: "CMS المحتوى", description: "الصفحات، المقالات، الأسئلة الشائعة، الشروط وسياسة الخصوصية بدون تعديل الكود.", href: "/admin/cms", icon: FileText },
  { title: "منشئ القائمة العامة", description: "إدارة روابط Header الفعلية وترتيبها وإظهارها للمستخدمين دون تعديل الكود.", href: "/admin/menu", icon: Layers3 },
  { title: "إدارة العقود", description: "قوالب العقود والتوقيعات والتجديدات والأرشفة والمراجعة النهائية.", href: "/admin/contracts", icon: ClipboardList },
  { title: "تحصيل الإيجارات والإضافات", description: "اتفاقات الإيجار، فواتير الاستحقاق، التأخير والإضافات المدفوعة للمتاجر والفروع.", href: "/admin/rentals", icon: CreditCard },
  { title: "إيرادات المنصة الموحدة", description: "تحديد إيجار أو عمولة أو نموذج هجين، اتفاق ترويج مستقل، وتقارير وكشوف شهرية موحدة للتجار.", href: "/admin/platform-revenue", icon: CreditCard },
  { title: "العمولات والضرائب", description: "قواعد عمولات وضرائب حسب المنصة والجناح والمتجر والموقع.", href: "/admin/commissions-taxes", icon: CreditCard },
  { title: "سجل مزودي الخدمات المالية", description: "حوكمة مركزية للبنوك والمحافظ وبوابات الدفع والحوالات وCOD قبل إتاحتها للتجار.", href: "/admin/financial-providers", icon: CreditCard },
  { title: "مركز الإشعارات", description: "Notification, Email, SMS, Push وقوالب الرسائل.", href: "/admin/notifications-center", icon: Bell },
  { title: "إدارة الأجنحة", description: "إنشاء وتعديل الأجنحة وصورها الافتراضية وترتيبها.", href: "/admin/wings", icon: Layers3 },
  { title: "طلبات التجار", description: "مراجعة واعتماد طلبات فتح المتاجر وإنشاء حسابات التجار.", href: "/admin/merchant-applications", icon: ClipboardList },
  { title: "مراجعة إطلاق المتاجر", description: "اعتماد ظهور المتجر للعامة بعد اكتمال الهوية والكتالوج والدفع والشحن.", href: "/admin/store-launch-readiness", icon: Store },
  { title: "تعديل هوية المتاجر", description: "مراجعة تغيير الاسم التجاري والبريد المعتمد عبر ملاحق عقود موقعة.", href: "/admin/identity-change-requests", icon: ShieldCheck },
  { title: "إدارة المتاجر", description: "تفعيل وتعطيل المتاجر، مراجعة البيانات والوسائط والتغطية.", href: "/admin/stores", icon: Store },
  { title: "إعدادات النظام والواجهة", description: "هوية النظام، Theme Builder، Layout Builder، محتوى الرئيسية والنوافذ من صفحة واحدة.", href: "/admin/settings", icon: SlidersHorizontal },
  { title: "مركز نصوص المتسوق", description: "مسودات، معاينة، نشر واسترجاع للنصوص الثابتة الظاهرة للمتسوق دون تكرار مديري المحتوى المتخصصين.", href: "/admin/text-center", icon: FileText },
  { title: "الإعلانات والبانرات والأخبار",  description: "إعلانات المول والبانرات وأخبار الشريط المتحرك وطلبات إعلانات المتاجر في صفحة واحدة.", href: "/admin/ads", icon: Megaphone },
  { title: "نافذة العروض", description: "مواسم العروض مثل رمضان والعيد واعتماد عروض المتاجر المجمعة.", href: "/admin/offers", icon: Megaphone },
  { title: "المناطق الجغرافية", description: "الدول، المحافظات، المدن والمناطق بقوائم مترابطة.", href: "/admin/geography", icon: Globe2 },
  { title: "الصلاحيات RBAC", description: "الأدوار والصلاحيات والقوالب المتقدمة وRole Templates في صفحة واحدة.", href: "/admin/roles", icon: ShieldCheck },
  { title: "موظفو المنصة", description: "بيانات وحالات حسابات موظفي المنصة؛ الحساب الجديد يبدأ دون أي صلاحية.", href: "/admin/employees", icon: Users },
  { title: "إدارة صلاحيات الموظفين", description: "أدوار وتجاوزات Grant/Deny مستقلة لكل شاشة وزر وعملية.", href: "/admin/permissions-management", icon: ShieldCheck },
  { title: "المستخدمون والعملاء", description: "إدارة التجار والموظفين والعملاء وحالات الحسابات.", href: "/admin/users", icon: Users },
  { title: "المنتجات", description: "مراقبة المنتجات والمتغيرات والمنتجات المروجة.", href: "/admin/products", icon: Package },
  { title: "كتالوج قطاعات التجار", description: "إنشاء قطاعات جاهزة بتصنيفات ووحدات وخصائص ومنتجات Draft تظهر للتاجر بلا برمجة.", href: "/admin/activity-templates", icon: Layers3 },
  { title: "سجل العمليات", description: "تتبع من قام بالعملية والبيانات قبل وبعد التعديل.", href: "/admin/audit-log", icon: Bell },
  { title: "إدارة الصور الافتراضية", description: "صور النشاط لكل جناح عند عدم رفع التاجر لصوره.", href: "/admin/default-media", icon: Images },
  { title: "الاشتراكات", description: "الباقات وحدود المنتجات والموظفين والإعلانات والفروع.", href: "/admin/subscriptions", icon: Building2 },
  { title: "النسخ الاحتياطي", description: "إنشاء وتنزيل واستعادة نسخ احتياطية للبيانات التشغيلية.", href: "/admin/backups", icon: DatabaseBackup },
  { title: "التقارير العامة", description: "مؤشرات ورسوم بيانية للمبيعات والطلبات وأفضل المتاجر.", href: "/admin/reports", icon: BarChart3 }
];

export default async function AdminDashboardPage() {
  const session = await requireAuth();
  await assertAdmin(session, "admin.access");
  const [userPermissions, currentUser] = await Promise.all([
    getUserPermissions(session.userId),
    db.select({ isTestAccount: users.isTestAccount }).from(users).where(eq(users.id, session.userId)).limit(1)
  ]);
  const permissionSet = new Set(userPermissions);
  const isSuperAdmin = session.roles.some((role) => role.code === "super_admin");
  const baseVisibleModules = isSuperAdmin ? modules : modules.filter((module) => {
    const required = modulePermissionByHref[module.href] || "admin.access";
    return permissionSet.has(required) || (required.startsWith("employees.") && permissionSet.has("roles.manage"));
  });
  const visibleModules = currentUser[0]?.isTestAccount ? baseVisibleModules.filter((module) => module.href !== "/admin/sensitive-control") : baseVisibleModules;
  const stats = await getAdminDashboardStats();
  const reviewBadges = await getAdminReviewBadges();

  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="admin-workspace-hero mb-8 flex flex-col justify-between gap-4 rounded-[2rem] border p-6 md:flex-row md:items-center md:p-7">
          <div>
            <h1 className="text-3xl font-black text-slate-950 md:text-4xl">لوحة الأدمن المركزية</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">تحكم كامل بجميع مكونات المنصة دون الحاجة لتعديل برمجي بعد الإطلاق.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">معاينة واجهة المول</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="المتاجر" value={stats.storesCount} />
          <StatCard title="المستخدمون" value={stats.usersCount} />
          <StatCard title="المنتجات" value={stats.productsCount} />
          <StatCard title="طلبات بانتظار المراجعة" value={stats.pendingApplicationsCount} />
        </div>

        <AdminDashboardWorkspace modules={visibleModules} reviewBadges={reviewBadges} />
      </section>
    </main>
  );
}



type AdminModule = (typeof modules)[number];

type WorkspaceGroup = { id: string; title: string; description: string; modules: AdminModule[] };

function adminWorkspaceGroup(href: string) {
  if (["/admin/command-center", "/admin/work-queue", "/admin/merchant-applications", "/admin/store-launch-readiness", "/admin/stores", "/admin/users", "/admin/employees"].includes(href)) return "operations";
  if (["/admin/ads", "/admin/offers", "/admin/products", "/admin/wings", "/admin/home-visibility", "/admin/home-exposure-revenue", "/admin/cms", "/admin/menu", "/admin/theme-builder", "/admin/home-builder", "/admin/default-media"].includes(href)) return "commerce";
  if (["/admin/rentals", "/admin/platform-revenue", "/admin/commissions-taxes", "/admin/financial-providers", "/admin/subscriptions", "/admin/reports"].includes(href)) return "finance";
  if (["/admin/security", "/admin/sensitive-control", "/admin/observability", "/admin/release-gates", "/admin/test-control", "/admin/backups", "/admin/integrations", "/admin/integrations/reconciliation", "/admin/scaling", "/admin/audit-log"].includes(href)) return "security";
  return "governance";
}

function AdminDashboardWorkspace({ modules, reviewBadges }: { modules: AdminModule[]; reviewBadges: Record<string, number> }) {
  const definitions = [
    { id: "operations", title: "قرارات وتشغيل اليوم", description: "طلبات وموافقات ومهام موظفي المنصة والمتاجر." },
    { id: "commerce", title: "التجارة والمحتوى", description: "الكتالوج، الواجهة، الإعلانات، العروض والأجنحة." },
    { id: "finance", title: "الإيرادات والالتزامات", description: "الإيجارات والعمولات والكشوف والمزودون." },
    { id: "security", title: "الحماية والبنية", description: "الأمن والمراقبة والنسخ والإطلاق والتكاملات." },
    { id: "governance", title: "الحوكمة والإعدادات", description: "السياسات والأدوار والإعدادات المركزية." }
  ];
  const groups: WorkspaceGroup[] = definitions.map((definition) => ({ ...definition, modules: modules.filter((module) => adminWorkspaceGroup(module.href) === definition.id) }));
  const urgent = modules.filter((module) => (reviewBadges[module.href] || 0) > 0);
  return <div className="mt-8 space-y-10">
    <section className="rounded-[2rem] border border-amber-200 bg-amber-50/70 p-5 shadow-card"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-black text-amber-800">قرارات تنتظر المراجعة</p><p className="mt-1 text-sm text-amber-900/70">هذه الأولوية اليومية؛ لا تحتاج للبحث داخل كل أقسام الإدارة.</p></div><BadgeSummary count={urgent.reduce((sum, module) => sum + (reviewBadges[module.href] || 0), 0)} /></div>{urgent.length ? <div className="mt-4 grid gap-3 md:grid-cols-3">{urgent.map((module) => <ModuleCard key={module.title} {...module} badgeCount={reviewBadges[module.href] || 0} />)}</div> : <p className="mt-4 rounded-2xl border border-amber-200 bg-white/70 p-4 text-sm font-bold text-amber-900">لا توجد مراجعات معلقة ظاهرة لصلاحياتك حالياً.</p>}</section>
    {groups.filter((group) => group.modules.length).map((group) => <section key={group.id}><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black text-slate-950">{group.title}</h2><p className="mt-1 text-sm text-slate-500">{group.description}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{group.modules.length} أقسام</span></div><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{group.modules.map((module) => <ModuleCard key={module.title} {...module} badgeCount={reviewBadges[module.href] || 0} />)}</div></section>)}
  </div>;
}

function BadgeSummary({ count }: { count: number }) { return <span className="rounded-full bg-amber-500 px-4 py-2 text-sm font-black text-white">{formatNumber(count)} مهمة</span>; }

async function getAdminReviewBadges(): Promise<Record<string, number>> {
  if (!hasDatabase()) return {};
  try {
    const [merchantApplicationsCount, storeOffersCount, homepageAdsCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(merchantApplications).where(inArray(merchantApplications.status, ["new", "pending", "under_review", "documents_required", "contract_signed", "waiting_final_approval"] as any)),
      db.select({ count: sql<number>`count(*)::int` }).from(storeOfferCollections).where(eq(storeOfferCollections.status, "pending_review")),
      db.select({ count: sql<number>`count(*)::int` }).from(adCampaigns).where(and(eq(adCampaigns.type, "homepage_banner"), inArray(adCampaigns.status, ["pending_review", "draft", "submitted"])))
    ]);
    return {
      "/admin/merchant-applications": Number(merchantApplicationsCount[0]?.count || 0),
      "/admin/offers": Number(storeOffersCount[0]?.count || 0),
      "/admin/ads": Number(homepageAdsCount[0]?.count || 0)
    };
  } catch {
    return {};
  }
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <Card className="admin-stat-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-black text-slate-950">{formatNumber(value)}</div>
      </CardContent>
    </Card>
  );
}
