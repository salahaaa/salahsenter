"use client";

import { useEffect, useMemo, useState } from "react";
import { convertFromBase, formatConvertedCurrency, type StoreCurrencySettings } from "@/lib/currency-shared";

export function CurrencyPrice({ amount, settings, className }: { amount: number | string | null | undefined; settings: StoreCurrencySettings; className?: string }) {
  const [selected, setSelected] = useState(settings.defaultCurrency);

  useEffect(() => {
    const stored = window.localStorage.getItem(`currency:${settings.defaultCurrency}`);
    if (stored && settings.currencies.some((currency) => currency.code === stored && currency.isActive)) setSelected(stored);
    const handler = (event: Event) => setSelected((event as CustomEvent<string>).detail);
    window.addEventListener("currency-change", handler);
    return () => window.removeEventListener("currency-change", handler);
  }, [settings]);

  const converted = useMemo(() => convertFromBase(amount, settings, selected), [amount, selected, settings]);

  return <span className={className}>{formatConvertedCurrency(converted.amount, converted.currency)}</span>;
}

export function CurrencySelector({ settings }: { settings: StoreCurrencySettings }) {
  const [selected, setSelected] = useState(settings.defaultCurrency);
  const active = useMemo(() => settings.currencies.filter((currency) => currency.isActive), [settings.currencies]);

  useEffect(() => {
    const stored = window.localStorage.getItem(`currency:${settings.defaultCurrency}`);
    if (stored && active.some((currency) => currency.code === stored)) setSelected(stored);
  }, [active, settings.defaultCurrency]);

  function change(value: string) {
    setSelected(value);
    window.localStorage.setItem(`currency:${settings.defaultCurrency}`, value);
    window.dispatchEvent(new CustomEvent("currency-change", { detail: value }));
  }

  useEffect(() => {
    const handler = (event: Event) => setSelected((event as CustomEvent<string>).detail);
    window.addEventListener("currency-change", handler);
    return () => window.removeEventListener("currency-change", handler);
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 shadow-sm">
      <span className="text-xs font-black text-slate-500">العملة</span>
      <select value={selected} onChange={(event) => change(event.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm font-black text-slate-700">
        {active.map((currency) => <option key={currency.code} value={currency.code}>{currency.name} ({currency.symbol})</option>)}
      </select>
    </div>
  );
}

export function CurrencySync({ settings }: { settings: StoreCurrencySettings }) {
  useEffect(() => {
    const stored = window.localStorage.getItem(`currency:${settings.defaultCurrency}`) || settings.defaultCurrency;
    const handler = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      document.querySelectorAll<HTMLElement>("[data-base-price]").forEach((element) => {
        const amount = Number(element.dataset.basePrice || 0);
        const converted = convertFromBase(amount, settings, value);
        element.textContent = formatConvertedCurrency(converted.amount, converted.currency);
      });
    };
    window.addEventListener("currency-change", handler);
    window.dispatchEvent(new CustomEvent("currency-change", { detail: stored }));
    return () => window.removeEventListener("currency-change", handler);
  }, [settings]);
  return null;
}
