// Commercial schedules and rotation are evaluated by a minute bucket in the data cache.
// Do not let the full route cache keep an expired campaign visible for 120 seconds.
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { getCachedHomeData } from "@/lib/cache/public-home-cache";
import { getPlatformIdentity, platformIdentitySchema } from "@/lib/platform-identity";
import { LuxuryMarketplaceHome } from "@/components/home/luxury-marketplace-home";
import { getCurrentSession } from "@/lib/auth";
import { Permission, userHasPermission } from "@/lib/rbac";
import { getExperiencePreviewForAdmin, type ExperiencePreviewScope } from "@/lib/experience-preview";
import { normalizeHomeContent } from "@/lib/home-content";
import { normalizeWelcomePopup } from "@/lib/welcome-popup";
import { buildSafeThemeCss } from "@/components/layout/theme-style";

const previewPermission: Record<ExperiencePreviewScope, string> = { platform_identity: Permission.ManageSettings, theme: Permission.ManageTheme, home_content: Permission.ManageHome, welcome_popup: Permission.ManageHome, home_sections: Permission.ManageHome };

export default async function HomePage({ searchParams }: { searchParams: Promise<{ experiencePreview?: string }> }) {
  const [{ experiencePreview: token }, data, identity, session] = await Promise.all([searchParams, getCachedHomeData(), getPlatformIdentity(), getCurrentSession()]);
  let preview: { scope: string; payload: Record<string, unknown> } | null = null;
  if (token && session) {
    const candidate = await getExperiencePreviewForAdmin(token, session.userId);
    if (candidate && await userHasPermission(session.userId, previewPermission[candidate.scope as ExperiencePreviewScope])) preview = candidate;
  }
  let nextData = data; let nextIdentity = identity; let previewCss = "";
  if (preview?.scope === "platform_identity") nextIdentity = platformIdentitySchema.parse(preview.payload);
  if (preview?.scope === "home_content") nextData = { ...data, homeContent: normalizeHomeContent({ ...(data.homeContent || {}), ...preview.payload }) };
  if (preview?.scope === "welcome_popup") nextData = { ...data, welcomePopup: normalizeWelcomePopup({ ...(data.welcomePopup || {}), ...preview.payload }) };
  if (preview?.scope === "home_sections") nextData = { ...data, homeSections: Array.isArray((preview.payload as any)?.sections) ? (preview.payload as any).sections : data.homeSections, homeLayoutManaged: true };
  if (preview?.scope === "theme") previewCss = buildSafeThemeCss(preview.payload as Record<string, string>);
  return <>{preview ? <div className="sticky top-0 z-[100] flex flex-wrap items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-center text-xs font-black text-slate-950">معاينة خاصة للأدمن — لا توجد تغييرات منشورة للعامة <Link className="underline" href="/">إنهاء المعاينة</Link></div> : null}{previewCss ? <style id="admin-experience-preview">{previewCss}</style> : null}<LuxuryMarketplaceHome data={nextData} identity={nextIdentity}/></>;
}
