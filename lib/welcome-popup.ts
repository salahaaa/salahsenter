import { and, eq } from "drizzle-orm";
import { db, systemSettings } from "@/lib/db";
import { isNextProductionBuildPhase } from "@/lib/runtime-phase";

export type WelcomePopupSettings = {
  enabled: boolean;
  showOnce: boolean;
  delayMs: number;
  imageUrl: string;
  badgeText: string;
  title: string;
  message: string;
  couponCode: string;
  buttonText: string;
  buttonUrl: string;
  closeOnBackdrop: boolean;
};

export const defaultWelcomePopup: WelcomePopupSettings = {
  enabled: true,
  showOnce: true,
  delayMs: 700,
  imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1400&q=85",
  badgeText: "احصل على خصم 10% على أول طلب",
  title: "أهلاً بك في المول الإلكتروني 🎉",
  message: "استخدم الكود WELCOME10 عند الدفع واستمتع بتجربة تسوق مميزة داخل صلاح سنتر.",
  couponCode: "WELCOME10",
  buttonText: "ابدأ التسوق",
  buttonUrl: "#featured-stores",
  closeOnBackdrop: true
};

export function normalizeWelcomePopup(value: unknown): WelcomePopupSettings {
  return { ...defaultWelcomePopup, ...((value || {}) as Partial<WelcomePopupSettings>) };
}

export async function getWelcomePopupSettings(): Promise<WelcomePopupSettings> {
  if (isNextProductionBuildPhase()) return defaultWelcomePopup;
  try {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(and(eq(systemSettings.group, "homepage"), eq(systemSettings.key, "welcome_popup")))
      .limit(1);
    return normalizeWelcomePopup(setting?.value);
  } catch {
    return defaultWelcomePopup;
  }
}
