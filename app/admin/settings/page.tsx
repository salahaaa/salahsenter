import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { SettingsForm } from "@/components/admin/settings-form";
import { ThemeBuilderForm } from "@/components/admin/enterprise/theme-builder-form";
import { HomeSectionBuilder } from "@/components/admin/home-section-builder";
import { HomeContentForm } from "@/components/admin/home-content-form";
import { WelcomePopupForm } from "@/components/admin/welcome-popup-form";
import { OffersPageSettingsForm } from "@/components/admin/offers-page-settings-form";
import { db, homeSections, systemSettings } from "@/lib/db";
import { defaultHomeSections } from "@/lib/home-layout";
import { isHomeLayoutManaged } from "@/lib/home-layout-management";
import { hasDatabase } from "@/lib/db/queries";
import { getHomeContentSettings } from "@/lib/home-content";
import { getWelcomePopupSettings } from "@/lib/welcome-popup";
import { getOffersPageSettings } from "@/lib/offers-page-settings";
import { getPlatformIdentity } from "@/lib/platform-identity";
import { requireAuth } from "@/lib/auth";
import { assertAdminOperation } from "@/lib/rbac";

export default async function AdminSettingsPage() {
  const session = await requireAuth();
  await assertAdminOperation(session, "system.settings.view");
  const [theme, sections, homeContent, welcomePopup, offersPageSettings, platformIdentity, homeLayoutManaged] = await Promise.all([
    hasDatabase() ? db.select().from(systemSettings).where(and(eq(systemSettings.group, "theme"), eq(systemSettings.key, "global"))).limit(1) : Promise.resolve([]),
    hasDatabase() ? db.select().from(homeSections).orderBy(asc(homeSections.sortOrder)) : Promise.resolve([]),
    getHomeContentSettings(),
    getWelcomePopupSettings(),
    getOffersPageSettings(),
    getPlatformIdentity(),
    isHomeLayoutManaged()
  ]);

  return (
    <main className="min-h-screen admin-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">إعدادات النظام والواجهة</h1>
            <p className="mt-2 text-sm text-slate-500">تم دمج إعدادات النظام وTheme Builder وLayout Builder في صفحة واحدة لتخفيف لوحة التحكم مع الحفاظ على الأداء.</p>
          </div>
          <Button asChild variant="outline"><Link href="/admin">العودة</Link></Button>
        </div>

        <div className="mb-8 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Anchor href="#platform" label="هوية المنصة" />
          <Anchor href="#theme" label="الثيم" />
          <Anchor href="#content" label="Hero والمحتوى" />
          <Anchor href="#welcome" label="الترحيب" />
          <Anchor href="#offers" label="صفحة العروض" />
          <Anchor href="#layout" label="الأقسام والتخطيط" />
        </div>

        <section id="platform" className="mb-10 scroll-mt-24">
          <h2 className="mb-4 text-2xl font-black text-slate-950">هوية النظام العامة</h2>
          <SettingsForm initial={platformIdentity} />
        </section>

        <section id="theme" className="mb-10 scroll-mt-24">
          <h2 className="mb-4 text-2xl font-black text-slate-950">Theme Builder</h2>
          <ThemeBuilderForm initial={(theme[0]?.value || {}) as Record<string, unknown>} />
        </section>

        <section id="content" className="mb-10 scroll-mt-24">
          <h2 className="mb-4 text-2xl font-black text-slate-950">محتوى الصفحة الرئيسية</h2>
          <HomeContentForm initial={homeContent} />
        </section>

        <section id="welcome" className="mb-10 scroll-mt-24">
          <h2 className="mb-4 text-2xl font-black text-slate-950">النافذة الترحيبية</h2>
          <WelcomePopupForm initial={welcomePopup} />
        </section>

        <section id="offers" className="mb-10 scroll-mt-24">
          <h2 className="mb-4 text-2xl font-black text-slate-950">واجهة صفحة العروض</h2>
          <OffersPageSettingsForm settings={offersPageSettings} />
        </section>

        <section id="layout" className="scroll-mt-24">
          <h2 className="mb-4 text-2xl font-black text-slate-950">Layout Builder</h2>
          <HomeSectionBuilder sections={homeLayoutManaged ? sections : effectiveHomeSections(sections)} managed={homeLayoutManaged} />
        </section>
      </section>
    </main>
  );
}

function Anchor({ href, label }: { href: string; label: string }) {
  return <a href={href} className="rounded-2xl border bg-white px-4 py-3 text-center text-sm font-black text-slate-700 shadow-card transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">{label}</a>;
}


function effectiveHomeSections(rows: Array<typeof homeSections.$inferSelect>) {
  const byCode = new Map(rows.map((row) => [row.code, row]));
  const defaults = defaultHomeSections.map((section) => ({ ...section, ...(byCode.get(section.code) || {}) }));
  const custom = rows.filter((row) => !defaultHomeSections.some((section) => section.code === row.code));
  return [...defaults, ...custom].sort((left, right) => left.sortOrder - right.sortOrder);
}
