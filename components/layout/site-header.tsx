import Link from "next/link";
import { Headphones, RotateCcw, ShieldCheck, Sparkles, Store, Truck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartSearchBox } from "@/components/search/smart-search-box";
import { HeaderActions } from "@/components/layout/header-actions";
import { getCurrentSession } from "@/lib/auth";
import { Permission, userHasPermission } from "@/lib/rbac";
import { getHomeContentSettings } from "@/lib/home-content";
import { getPublicMenuItems } from "@/lib/menu/public-menu";
import { getPlatformIdentity } from "@/lib/platform-identity";
import { getPublishedTextOverrides } from "@/lib/text-center/service";

export async function SiteHeader() {
  const [session, content, menu, identity, text] = await Promise.all([getCurrentSession(), getHomeContentSettings(), getPublicMenuItems(), getPlatformIdentity(), getPublishedTextOverrides("ar")]);
  const platformName = identity.platformName || content.platformName || "صلاح سنتر";
  const logoLetter = identity.shortName || content.logoLetter || platformName.slice(0, 1);
  // User permission overrides are evaluated live so a newly granted admin
  // employee sees the correct panel without waiting for their JWT to expire.
  const isAdmin = Boolean(session && await userHasPermission(session.userId, Permission.AdminAccess));
  const isMerchant = session?.roles.some((role) => role.scope === "store" || ["merchant", "store_employee"].includes(role.code));

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-white/90 shadow-sm backdrop-blur-2xl">
      {identity.header.topBarEnabled ? <div className="hidden border-b border-slate-100 bg-slate-950 text-white md:block">
        <div className="container flex h-9 items-center justify-between gap-4 text-[11px] font-black">
          <span className="inline-flex items-center gap-2 text-amber-300"><Sparkles className="h-3.5 w-3.5" /> {identity.header.topBarText}</span>
          {identity.header.showTrustMessages ? <div className="flex items-center gap-5 text-white/75">
            <span className="inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5 text-emerald-300" /> {text["header.trust.shipping"] || "خيارات شحن حسب المتجر"}</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-blue-300" /> {text["header.trust.reviewable_stores"] || "متاجر قابلة للمراجعة"}</span>
            <span className="inline-flex items-center gap-1"><RotateCcw className="h-3.5 w-3.5 text-orange-300" /> {text["header.trust.policy"] || "سياسة واضحة لكل متجر"}</span>
          </div> : null}
        </div>
      </div> : null}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-blue-400 to-transparent" />
      <div className="container flex h-20 items-center gap-4">
        <Link href="/" prefetch={false} className="group flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-blue-600/20 transition group-hover:scale-105">
            {identity.logoUrl ? <img src={identity.logoUrl} alt={platformName} className="h-full w-full rounded-2xl object-cover" /> : logoLetter.length <= 2 ? <span className="text-lg font-black">{logoLetter}</span> : <Store className="h-6 w-6" />}
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-lg font-black text-slate-950">{platformName}</span>
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-blue-500"><Sparkles className="h-3 w-3" /> {identity.tagline}</span>
          </span>
        </Link>

        <div className="hidden flex-1 md:block">
          <SmartSearchBox />
        </div>

        {menu.length ? <nav aria-label="القائمة الرئيسية" className="hidden items-center gap-3 lg:flex">{menu.slice(0, 5).map((item) => item.target === "_blank" ? <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="text-xs font-black text-slate-600 transition hover:text-primary">{item.title}</a> : <Link key={item.id} href={item.url} className="text-xs font-black text-slate-600 transition hover:text-primary">{item.title}</Link>)}</nav> : null}

        <nav className="mr-auto flex items-center gap-2">
          {isAdmin ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin">لوحة الأدمن</Link>
            </Button>
          ) : null}
          {isMerchant ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/merchant">لوحة التاجر</Link>
            </Button>
          ) : null}
          {!isAdmin && !isMerchant && identity.header.showOpenStoreCta ? (
            <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
              <Link href="/apply-store">{identity.header.openStoreLabel}</Link>
            </Button>
          ) : null}
          {session ? (
            <>
              <span className="hidden rounded-full border border-white/70 bg-white/80 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm md:inline-flex">
                {session.fullName}
              </span>
              <HeaderActions isAuthenticated />
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">
                <UserRound className="h-4 w-4" /> دخول
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
