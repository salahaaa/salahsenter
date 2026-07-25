import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, BadgeCheck, LockKeyhole, ShieldCheck, Sparkles, Store } from "lucide-react";
import { getHomeContentSettings } from "@/lib/home-content";

export async function AuthShell({
  title,
  description,
  backHref = "/",
  backLabel = "العودة للرئيسية",
  children,
  sideTitle,
  sideDescription = "منصة مول إلكتروني احترافية متعددة المتاجر، مصممة لتجربة أسرع وأكثر ثقة للتاجر والعميل."
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
  sideTitle?: string;
  sideDescription?: string;
}) {
  const content = await getHomeContentSettings();
  const resolvedSideTitle = sideTitle || content.platformName || "صلاح سنتر";
  const values = [
    { label: "دخول محمي", icon: LockKeyhole },
    { label: "جلسات آمنة", icon: ShieldCheck },
    { label: "إدارة موثوقة", icon: BadgeCheck }
  ];

  return (
    <main className="auth-atelier relative min-h-screen overflow-hidden p-4 text-slate-950 sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -right-24 top-12 h-80 w-80 rounded-full bg-blue-300/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-teal-200/20 blur-3xl" aria-hidden="true" />

      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl items-stretch gap-5 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[.98fr_1.02fr] lg:gap-7">
        <aside className="auth-showcase hidden overflow-hidden rounded-[2.35rem] p-8 text-white lg:block">
          <span className="auth-orbit auth-orbit-one" aria-hidden="true" />
          <span className="auth-orbit auth-orbit-two" aria-hidden="true" />
          <div className="relative flex min-h-[590px] flex-col justify-between">
            <Link href="/" className="auth-brand-link inline-flex w-fit items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black text-white transition">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 text-slate-950 shadow-lg shadow-amber-300/15"><Store className="h-4 w-4" /></span>
              {resolvedSideTitle}
            </Link>

            <div className="max-w-xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-black text-amber-100 shadow-inner shadow-white/5 backdrop-blur">
                <Sparkles className="h-4 w-4 text-amber-300" /> بوابة رقمية موثوقة
              </div>
              <h2 className="max-w-lg text-4xl font-black leading-[1.2] tracking-tight xl:text-5xl">تجربة احترافية تبدأ من أول دخول.</h2>
              <p className="mt-5 max-w-lg text-sm leading-8 text-slate-200/75">{sideDescription}</p>

              <div className="mt-9 grid gap-3 sm:grid-cols-3">
                {values.map(({ label, icon: Icon }) => (
                  <div key={label} className="auth-value-card rounded-2xl p-4 text-center backdrop-blur">
                    <Icon className="auth-value-icon mx-auto mb-2 h-5 w-5 text-emerald-300" />
                    <p className="text-xs font-black text-white/90">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-bold text-white/55">
              <span className="h-px flex-1 bg-white/10" />
              منصة متعددة المتاجر قابلة للتوسع
              <span className="h-px flex-1 bg-white/10" />
            </div>
          </div>
        </aside>

        <section className="mx-auto flex w-full max-w-xl flex-col justify-center py-3 lg:py-8">
          <div className="auth-mobile-brand mb-5 flex items-center justify-between rounded-2xl px-4 py-3 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 text-white"><Store className="h-4 w-4" /></span>
              {resolvedSideTitle}
            </Link>
            <span className="text-[11px] font-black text-teal-700">بوابة آمنة</span>
          </div>

          <div className="mb-6 text-center sm:mb-7">
            <Link href={backHref} className="auth-back-link inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition hover:-translate-y-0.5">
              <ArrowRight className="h-4 w-4" /> {backLabel}
            </Link>
            <div className="auth-identity-icon mx-auto mt-6 grid h-16 w-16 place-items-center rounded-[1.35rem] text-white">
              <Store className="h-8 w-8" />
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[.22em] text-blue-600">{resolvedSideTitle}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
            {description ? <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">{description}</p> : null}
          </div>

          <div className="auth-frame rounded-[2rem] p-2.5 backdrop-blur-xl sm:rounded-[2.2rem] sm:p-3">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
