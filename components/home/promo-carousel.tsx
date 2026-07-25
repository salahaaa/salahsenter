"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Gift, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WelcomePopupSettings } from "@/lib/welcome-popup";

type PromoSlide = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl: string;
  linkUrl?: string | null;
};

const welcomeStorageKey = "salah_center_welcome_popup_seen_v1";

export function WelcomePopup({ settings }: { settings: WelcomePopupSettings }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!settings.enabled) return;
    if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
    if (settings.showOnce && window.localStorage.getItem(welcomeStorageKey) === "1") return;
    const timer = window.setTimeout(() => setOpen(true), Math.max(settings.delayMs || 0, 1500));
    return () => window.clearTimeout(timer);
  }, [settings.delayMs, settings.enabled, settings.showOnce]);

  function close() {
    if (settings.showOnce) window.localStorage.setItem(welcomeStorageKey, "1");
    setOpen(false);
  }

  if (!mounted || !open || !settings.enabled) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-4 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => settings.closeOnBackdrop && close()} role="dialog" aria-modal="true">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-[0_35px_120px_rgba(0,0,0,.45)] animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 md:rounded-[2.5rem]" onClick={(event) => event.stopPropagation()}>
        <button onClick={close} className="absolute right-6 top-6 z-10 grid h-14 w-14 place-items-center rounded-full bg-white/90 text-slate-900 shadow-xl backdrop-blur transition hover:scale-105 hover:bg-white" aria-label="إغلاق">
          <X className="h-7 w-7" />
        </button>
        <div className="relative h-72 overflow-hidden bg-slate-100 md:h-80">
          {settings.imageUrl ? <img src={settings.imageUrl} alt={settings.title} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          <div className="absolute left-6 top-6 hidden rounded-full bg-white/15 px-4 py-2 text-xs font-black text-white backdrop-blur md:flex">
            <Sparkles className="ml-1 h-4 w-4 text-amber-300" /> عرض ترحيبي
          </div>
        </div>
        <div className="px-7 py-8 text-center md:px-12 md:py-10">
          {settings.badgeText ? (
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-5 py-2 text-sm font-black text-amber-800">
              <Gift className="h-4 w-4" /> {settings.badgeText}
            </div>
          ) : null}
          <h2 className="text-3xl font-black leading-tight tracking-tight text-slate-950 md:text-5xl">{settings.title}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-9 text-slate-700 md:text-2xl">{settings.message}</p>
          {settings.couponCode ? <div className="mx-auto mt-6 inline-flex rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-5 py-3 text-lg font-black text-amber-700">الكود: {settings.couponCode}</div> : null}
          <Button asChild size="lg" className="mt-8 h-16 w-full rounded-[1.7rem] bg-gradient-to-l from-amber-500 to-yellow-300 text-xl font-black text-slate-950 shadow-xl shadow-amber-500/20 hover:from-amber-600 hover:to-yellow-400 md:max-w-xl">
            <Link href={settings.buttonUrl || "/"} onClick={close}>{settings.buttonText}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PromoCarousel({
  promos,
  primaryButton,
  secondaryButton
}: {
  promos: PromoSlide[];
  primaryButton: string;
  secondaryButton: string;
}) {
  const slides = useMemo(() => promos.filter((item) => item.imageUrl), [promos]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 4500);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (!slides.length) return null;

  const current = slides[active] || slides[0];
  const goNext = () => setActive((index) => (index + 1) % slides.length);
  const goPrev = () => setActive((index) => (index - 1 + slides.length) % slides.length);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 md:py-12" id="homepage-promos">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 shadow-2xl shadow-slate-900/15 md:rounded-[2.5rem]">
        <img key={current.id} src={current.imageUrl} alt={current.title} className="absolute inset-0 h-full w-full object-cover opacity-100 transition duration-700" loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/15 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-2/3 bg-gradient-to-l from-slate-950/55 via-slate-950/20 to-transparent" />
        <div className="relative flex min-h-[22rem] items-end justify-between gap-4 px-4 py-6 text-white md:min-h-[26rem] md:px-10 md:py-9">
          <button type="button" onClick={goPrev} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/45" aria-label="السابق"><ChevronRight className="h-6 w-6" /></button>
          <div className="max-w-2xl rounded-[1.7rem] border border-white/15 bg-slate-950/38 p-5 text-right shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-500 md:p-7" key={current.id}>
            <h2 className="text-3xl font-black leading-tight drop-shadow-lg md:text-5xl">{current.title}</h2>
            <p className="mt-4 text-sm font-semibold leading-7 text-white/90 drop-shadow md:text-base">{current.description || "اكتشف أحدث العروض المختارة من إدارة المول"}</p>
            {current.linkUrl ? <p className="mt-5 text-xs font-bold text-white/70">لوحة إعلانية بصريّة — الصورة تغطي كامل اللوحة وتظهر بوضوح.</p> : null}
          </div>
          <button type="button" onClick={goNext} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-black/30 text-white backdrop-blur transition hover:bg-black/45" aria-label="التالي"><ChevronLeft className="h-6 w-6" /></button>
        </div>
        {slides.length > 1 ? (
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((slide, index) => (
              <button key={slide.id} type="button" onClick={() => setActive(index)} className={`h-2 rounded-full transition-all ${index === active ? "w-8 bg-orange-400" : "w-2 bg-white/40"}`} aria-label={`انتقال إلى الإعلان ${index + 1}`} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
