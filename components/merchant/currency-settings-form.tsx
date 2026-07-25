"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CurrencyRate, StoreCurrencySettings } from "@/lib/currency-shared";

export function CurrencySettingsForm({ storeId, initial }: { storeId: string; initial: StoreCurrencySettings }) {
  const [defaultCurrency, setDefaultCurrency] = useState(initial.defaultCurrency);
  const [currencies, setCurrencies] = useState<CurrencyRate[]>(initial.currencies);
  const [message, setMessage] = useState<string | null>(null);

  function update(index: number, patch: Partial<CurrencyRate>) {
    setCurrencies((prev) => prev.map((currency, i) => i === index ? { ...currency, ...patch } : currency));
  }

  function addCurrency() {
    setCurrencies((prev) => [...prev, { code: "", name: "", symbol: "", rateToBase: 1, isActive: true }]);
  }

  function remove(index: number) {
    setCurrencies((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = currencies.map((currency) => ({ ...currency, code: currency.code.toUpperCase(), rateToBase: currency.code.toUpperCase() === defaultCurrency ? 1 : Number(currency.rateToBase || 1) }));
    const response = await fetch("/api/merchant/currencies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, defaultCurrency, currencies: normalized })
    });
    const json = await response.json();
    setMessage(response.ok ? "✓ تم حفظ إعدادات العملات" : json.message || "تعذر حفظ العملات");
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border bg-white p-6 shadow-card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-950">إعدادات العملات والتسعير</h2>
          <p className="mt-1 text-sm text-slate-500">حدد العملة الافتراضية للمتجر وسعر كل عملة أجنبية مقابلها.</p>
        </div>
        <div className="space-y-2">
          <Label>العملة الافتراضية</Label>
          <select value={defaultCurrency} onChange={(event) => setDefaultCurrency(event.target.value)} className="h-11 rounded-xl border bg-white px-4 text-sm font-bold">
            {currencies.filter((currency) => currency.code).map((currency) => <option key={currency.code} value={currency.code.toUpperCase()}>{currency.code.toUpperCase()} - {currency.name}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {currencies.map((currency, index) => {
          const isBase = currency.code.toUpperCase() === defaultCurrency;
          return (
            <div key={`${currency.code}-${index}`} className="grid gap-3 rounded-2xl border bg-slate-50 p-4 md:grid-cols-[120px_1fr_120px_180px_90px_80px] md:items-end">
              <Field label="الكود" value={currency.code} onChange={(value) => update(index, { code: value.toUpperCase() })} placeholder="YER" />
              <Field label="اسم العملة" value={currency.name} onChange={(value) => update(index, { name: value })} placeholder="الريال اليمني" />
              <Field label="الرمز" value={currency.symbol} onChange={(value) => update(index, { symbol: value })} placeholder="ر.ي" />
              <Field label={isBase ? "سعر العملة الافتراضية" : `كم ${defaultCurrency} = 1 ${currency.code || "عملة"}`} type="number" value={String(isBase ? 1 : currency.rateToBase)} disabled={isBase} onChange={(value) => update(index, { rateToBase: Number(value || 1) })} />
              <label className="flex items-center gap-2 pb-3 text-sm font-bold"><input type="checkbox" checked={currency.isActive} onChange={(event) => update(index, { isActive: event.target.checked })} /> نشطة</label>
              <Button type="button" variant="destructive" disabled={isBase} onClick={() => remove(index)}>حذف</Button>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={addCurrency}>إضافة عملة</Button>
        <Button>حفظ العملات</Button>
        {message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}
      </div>
    </form>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", disabled = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; disabled?: boolean }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder || ""} /></div>;
}
