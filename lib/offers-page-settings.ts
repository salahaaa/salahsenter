import { and, eq } from "drizzle-orm";
import { db, systemSettings } from "@/lib/db";
import { inlineSettingsMediaUrl } from "@/lib/inline-media";

export type OffersPageSettings = {
  heroBadge: string;
  heroTitle: string;
  heroDescription: string;
  heroPrimaryLabel: string;
  heroPrimaryUrl: string;
  heroSecondaryLabel: string;
  heroSecondaryUrl: string;
  heroBackgroundColor: string;
  heroTextColor: string;
  heroBackgroundImage: string;
  showHeroButtons: boolean;
  listTitle: string;
  listSubtitle: string;
  listDescription: string;
  listBackgroundColor: string;
  listTextColor: string;
  listBackgroundImage: string;
  adminSectionTitle: string;
  adminSectionSubtitle: string;
  recommendationTitle: string;
  recommendationDescription: string;
};

export const defaultOffersPageSettings: OffersPageSettings = {
  heroBadge: "Smart Offers System",
  heroTitle: "نافذة عروض ذكية تشبه المولات العالمية",
  heroDescription: "كل عرض يظهر في قسم واحد فقط لتجربة خفيفة وسريعة بدون تكرار.",
  heroPrimaryLabel: "تسوق عروض المتاجر",
  heroPrimaryUrl: "#merchant-offers",
  heroSecondaryLabel: "عروض الإدارة",
  heroSecondaryUrl: "#admin-offers",
  heroBackgroundColor: "#020617",
  heroTextColor: "#ffffff",
  heroBackgroundImage: "",
  showHeroButtons: true,
  listTitle: "عروض أخرى من المتاجر",
  listSubtitle: "بلا تكرار",
  listDescription: "عروض إضافية من المتاجر تظهر في مكان واحد فقط حتى تبقى الصفحة خفيفة.",
  listBackgroundColor: "#ffffff",
  listTextColor: "#0f172a",
  listBackgroundImage: "",
  adminSectionTitle: "عروض الإدارة والإعلانات الترويجية",
  adminSectionSubtitle: "هذه عروض تسويقية قد تحتوي بيانات تواصل أو روابط خارجية وليست دائماً شراء مباشر.",
  recommendationTitle: "اقتراحات ذكية لك",
  recommendationDescription: "نقترح لك العروض حسب قوة العرض والتفاعل والمدة. لاحقاً سيتم ربطها بسلوك العميل وسجل المشاهدة."
};

export function normalizeOffersPageSettings(value: unknown): OffersPageSettings {
  return { ...defaultOffersPageSettings, ...((value || {}) as Partial<OffersPageSettings>) };
}

export function compactOffersPageMedia(settings: OffersPageSettings): OffersPageSettings {
  return {
    ...settings,
    heroBackgroundImage: inlineSettingsMediaUrl("offers", "page_settings", "heroBackgroundImage", settings.heroBackgroundImage),
    listBackgroundImage: inlineSettingsMediaUrl("offers", "page_settings", "listBackgroundImage", settings.listBackgroundImage)
  };
}

export async function getOffersPageSettings(): Promise<OffersPageSettings> {
  try {
    const [setting] = await db.select().from(systemSettings).where(and(eq(systemSettings.group, "offers"), eq(systemSettings.key, "page_settings"))).limit(1);
    return compactOffersPageMedia(normalizeOffersPageSettings(setting?.value));
  } catch {
    return defaultOffersPageSettings;
  }
}
