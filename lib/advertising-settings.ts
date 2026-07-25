import { and, eq } from "drizzle-orm";
import { db, systemSettings } from "@/lib/db";

export type AdvertisingSettings = {
  maxActiveStoreAnnouncements: number;
  maxActiveStoreNews: number;
  marketplaceAnnouncementsLimit: number;
  storeAnnouncementsLimit: number;
  storeNewsLimit: number;
  enablePromotedOffers: boolean;
};

export const defaultAdvertisingSettings: AdvertisingSettings = {
  maxActiveStoreAnnouncements: 3,
  maxActiveStoreNews: 10,
  marketplaceAnnouncementsLimit: 8,
  storeAnnouncementsLimit: 8,
  storeNewsLimit: 10,
  enablePromotedOffers: true
};

export async function getAdvertisingSettings(): Promise<AdvertisingSettings> {
  try {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(and(eq(systemSettings.group, "advertising"), eq(systemSettings.key, "limits")))
      .limit(1);
    return { ...defaultAdvertisingSettings, ...((setting?.value || {}) as Partial<AdvertisingSettings>) };
  } catch {
    return defaultAdvertisingSettings;
  }
}
