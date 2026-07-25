import { and, eq } from "drizzle-orm";
import { db, systemSettings } from "@/lib/db";
import { isNextProductionBuildPhase } from "@/lib/runtime-phase";

export type HomeContentSettings = {
  platformName: string;
  platformSubtitle: string;
  logoLetter: string;
  searchPlaceholder: string;
  loginLabel: string;
  openStoreLabel: string;
  newsLabel: string;
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  heroBackgroundImage: string;
  heroWingsLabel: string;
  heroStoresLabel: string;
  heroAvailabilityLabel: string;
  promoPrimaryButton: string;
  promoSecondaryButton: string;
  featuredStoresKicker: string;
  featuredStoresDescription: string;
  wingsKicker: string;
  wingsDescription: string;
  wingsAllButton: string;
  productsKicker: string;
  latestTitle: string;
  latestHighlight: string;
  merchantCtaBadge: string;
  merchantCtaTitle: string;
  merchantCtaDescription: string;
  merchantCtaButton: string;
  footerText: string;
  contactPhone: string;
  contactEmail: string;
  whatsappUrl: string;
  facebookUrl: string;
  instagramUrl: string;
};

export const defaultHomeContent: HomeContentSettings = {
  platformName: "المول التجاري الرقمي",
  platformSubtitle: "Luxury Marketplace",
  logoLetter: "M",
  searchPlaceholder: "ابحث عن متجر، جناح، منتج...",
  loginLabel: "دخول",
  openStoreLabel: "افتح متجرك",
  newsLabel: "آخر الأخبار",
  heroBadge: "وجهة التسوق الأولى",
  heroTitle: "المول التجاري الرقمي",
  heroSubtitle: "مركز تجاري متكامل يجمع أرقى المحلات والعلامات التجارية تحت سقف واحد - تجربة تسوق فاخرة لا تُنسى",
  heroBackgroundImage: "",
  heroWingsLabel: "جناح تجاري",
  heroStoresLabel: "محل ومتجر",
  heroAvailabilityLabel: "تسوق متواصل",
  promoPrimaryButton: "تسوق الآن ←",
  promoSecondaryButton: "جميع العروض",
  featuredStoresKicker: "FEATURED STORES ⭐",
  featuredStoresDescription: "مزيج من اختيار الإدارة + الأكثر مبيعاً تلقائياً",
  wingsKicker: "WINGS • أجنحتنا ●",
  wingsDescription: "كل جناح يضم نخبة من المتاجر المعتمدة",
  wingsAllButton: "كل الأجنحة ←",
  productsKicker: "PRODUCTS ✦",
  latestTitle: "أحدث الإضافات",
  latestHighlight: "من متاجر المول",
  merchantCtaBadge: "انضم إلى المول",
  merchantCtaTitle: "افتح متجرك داخل صلاح سنتر",
  merchantCtaDescription: "قدّم طلبك، وقّع العقد إلكترونياً، واحصل على مساحة بيع احترافية داخل المول.",
  merchantCtaButton: "طلب فتح متجر",
  footerText: "© صلاح سنتر — المول التجاري الرقمي",
  contactPhone: "",
  contactEmail: "",
  whatsappUrl: "",
  facebookUrl: "",
  instagramUrl: ""
};

export function normalizeHomeContent(value: unknown): HomeContentSettings {
  return { ...defaultHomeContent, ...((value || {}) as Partial<HomeContentSettings>) };
}

const homeContentCache = globalThis as typeof globalThis & { __homeContentSettingsCache?: { value: HomeContentSettings; expiresAt: number } };

export function invalidateHomeContentSettingsCache() {
  delete homeContentCache.__homeContentSettingsCache;
}

export async function getHomeContentSettings(): Promise<HomeContentSettings> {
  if (isNextProductionBuildPhase()) return defaultHomeContent;
  const now = Date.now();
  if (homeContentCache.__homeContentSettingsCache && homeContentCache.__homeContentSettingsCache.expiresAt > now) return homeContentCache.__homeContentSettingsCache.value;
  try {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(and(eq(systemSettings.group, "homepage"), eq(systemSettings.key, "content")))
      .limit(1);
    const value = normalizeHomeContent(setting?.value);
    homeContentCache.__homeContentSettingsCache = { value, expiresAt: now + Number(process.env.HOME_CONTENT_CACHE_MS || 30_000) };
    return value;
  } catch {
    return defaultHomeContent;
  }
}
