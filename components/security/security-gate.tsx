import Link from "next/link";
import { headers } from "next/headers";
import { ShieldAlert } from "lucide-react";
import { getCurrentSession, hasRole } from "@/lib/auth";
import { getPlatformSecuritySettings, isPlatformLocked } from "@/lib/security-settings";
import { Button } from "@/components/ui/button";

const allowedPaths = ["/login", "/api/auth/login", "/api/health"];

export async function SecurityGate({ children }: { children: React.ReactNode }) {
  const settings = await getPlatformSecuritySettings();
  const locked = isPlatformLocked(settings);

  // المسار السريع: عندما لا توجد صيانة/إغلاق طارئ لا نقرأ الكوكيز أو الهيدرز.
  // هذا يسمح للصفحات العامة مثل الرئيسية بالاستفادة من ISR/CDN بدلاً من no-cache لكل زائر.
  if (!locked) return <>{children}</>;

  const [session, h] = await Promise.all([getCurrentSession(), headers()]);
  const pathname = h.get("x-pathname") || "/";
  const isAdmin = hasRole(session, "super_admin");
  const isAllowedPath = allowedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (isAdmin || isAllowedPath || pathname.startsWith("/_next")) return <>{children}</>;

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,_rgba(239,68,68,.18),_transparent_35%),#0f172a] p-4 text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/10 p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full bg-red-500/20 text-red-200">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h1 className="text-3xl font-black md:text-5xl">{settings.messageTitle}</h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-8 text-white/75 md:text-base">{settings.messageBody}</p>
        {settings.reason ? <p className="mt-4 rounded-2xl bg-black/20 p-3 text-xs font-bold text-white/60">سبب الإيقاف: {settings.reason}</p> : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild variant="secondary"><Link href="/login">دخول الإدارة</Link></Button>
        </div>
      </section>
    </main>
  );
}
