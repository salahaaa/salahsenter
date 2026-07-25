export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { Metadata } from "next";
import "./globals.css";
import { ThemeStyle } from "@/components/layout/theme-style";
import { SecurityGate } from "@/components/security/security-gate";
import { CsrfFetchProvider } from "@/components/security/csrf-fetch-provider";
import { NavigationProgress } from "@/components/navigation/navigation-progress";
import { LazyAIShoppingAssistant } from "@/components/assistant/lazy-ai-shopping-assistant";
import { getRequestTenantContext } from "@/lib/tenancy/context";
import { getPlatformIdentity } from "@/lib/platform-identity";
import { getPublishedTextOverrides } from "@/lib/text-center/service";
import { PlatformTextHydrator } from "@/components/text-center/platform-text-hydrator";

export async function generateMetadata(): Promise<Metadata> {
  const [context, identity] = await Promise.all([getRequestTenantContext().catch(() => null), getPlatformIdentity()]);
  const name = context?.tenant.name || identity.platformName || "مول إلكتروني متعدد المتاجر";
  return { title: name, description: context ? `واجهة ${name} التجارية المستقلة.` : identity.description || "منصة Marketplace سحابية متعددة المتاجر قابلة للتوسع والإدارة الكاملة.", applicationName: name, icons: identity.iconUrl ? { icon: identity.iconUrl } : undefined };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [context, platformText] = await Promise.all([getRequestTenantContext().catch(() => null), getPublishedTextOverrides("ar")]);
  return (
    <html lang={context?.tenant.defaultLocale || "ar"} dir="rtl" data-tenant-id={context?.tenant.id || undefined}>
      <body><ThemeStyle /><PlatformTextHydrator values={platformText} /><CsrfFetchProvider /><NavigationProgress /><SecurityGate>{children}<LazyAIShoppingAssistant /></SecurityGate></body>
    </html>
  );
}
