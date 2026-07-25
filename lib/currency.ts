import { and, eq } from "drizzle-orm";
import { db, systemSettings } from "@/lib/db";
export { convertFromBase, defaultCurrencySettings, formatConvertedCurrency, getCurrency, normalizeCurrencySettings } from "@/lib/currency-shared";
export type { CurrencyRate, StoreCurrencySettings } from "@/lib/currency-shared";
import { defaultCurrencySettings, normalizeCurrencySettings, type StoreCurrencySettings } from "@/lib/currency-shared";

export async function getStoreCurrencySettings(storeId: string): Promise<StoreCurrencySettings> {
  try {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(and(eq(systemSettings.group, `store:${storeId}`), eq(systemSettings.key, "currency_settings")))
      .limit(1);
    return normalizeCurrencySettings(setting?.value);
  } catch {
    return defaultCurrencySettings;
  }
}
