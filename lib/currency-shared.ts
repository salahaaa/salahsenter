export type CurrencyRate = {
  code: string;
  name: string;
  symbol: string;
  rateToBase: number;
  isActive: boolean;
};

export type StoreCurrencySettings = {
  defaultCurrency: string;
  currencies: CurrencyRate[];
};

export const defaultCurrencySettings: StoreCurrencySettings = {
  defaultCurrency: "YER",
  currencies: [
    { code: "YER", name: "الريال اليمني", symbol: "ر.ي", rateToBase: 1, isActive: true },
    { code: "SAR", name: "الريال السعودي", symbol: "ر.س", rateToBase: 140, isActive: true },
    { code: "USD", name: "الدولار الأمريكي", symbol: "$", rateToBase: 530, isActive: true }
  ]
};

export function normalizeCurrencySettings(value: unknown): StoreCurrencySettings {
  const incoming = (value || {}) as Partial<StoreCurrencySettings>;
  const merged: StoreCurrencySettings = {
    defaultCurrency: incoming.defaultCurrency || defaultCurrencySettings.defaultCurrency,
    currencies: Array.isArray(incoming.currencies) && incoming.currencies.length ? incoming.currencies : defaultCurrencySettings.currencies
  };

  const hasBase = merged.currencies.some((currency) => currency.code === merged.defaultCurrency);
  if (!hasBase) {
    merged.currencies.unshift({ code: merged.defaultCurrency, name: merged.defaultCurrency, symbol: merged.defaultCurrency, rateToBase: 1, isActive: true });
  }

  return {
    ...merged,
    currencies: merged.currencies.map((currency) => ({ ...currency, code: currency.code.toUpperCase(), rateToBase: Number(currency.rateToBase || 1), isActive: Boolean(currency.isActive) }))
  };
}

export function getCurrency(settings: StoreCurrencySettings, code?: string | null) {
  const activeCurrencies = settings.currencies.filter((currency) => currency.isActive);
  return activeCurrencies.find((currency) => currency.code === code) || activeCurrencies.find((currency) => currency.code === settings.defaultCurrency) || activeCurrencies[0] || defaultCurrencySettings.currencies[0];
}

export function convertFromBase(amount: number | string | null | undefined, settings: StoreCurrencySettings, targetCurrencyCode?: string | null) {
  const value = Number(amount || 0);
  const currency = getCurrency(settings, targetCurrencyCode);
  const rate = Number(currency.rateToBase || 1);
  return { amount: rate > 0 ? value / rate : value, currency };
}

export function formatConvertedCurrency(amount: number, currency: CurrencyRate) {
  const formatted = new Intl.NumberFormat("ar", { maximumFractionDigits: currency.code === "YER" ? 0 : 2 }).format(amount);
  return `${formatted} ${currency.symbol || currency.code}`;
}
