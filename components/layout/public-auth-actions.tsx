"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Store, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

type SessionInfo = { fullName: string; isAdmin: boolean; isMerchant: boolean } | null;

export function PublicAuthActions({ loginLabel, openStoreLabel }: { loginLabel: string; openStoreLabel: string }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo>(null);
  const [loaded, setLoaded] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((json) => {
        if (!active) return;
        setSession(json?.data?.session || null);
      })
      .catch(() => {})
      .finally(() => active && setLoaded(true));
    return () => { active = false; };
  }, []);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setSession(null);
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  if (!loaded) {
    return <Button asChild className="rounded-xl bg-slate-950 text-white hover:bg-slate-800"><Link href="/login"><LogIn className="h-4 w-4" /> {loginLabel}</Link></Button>;
  }

  if (session) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="hidden rounded-xl border bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm md:inline-flex"><UserRound className="ml-1 h-4 w-4" /> {session.fullName}</span>
        {session.isAdmin ? <Button asChild className="rounded-xl bg-slate-950 text-white"><Link href="/admin">لوحة الأدمن</Link></Button> : null}
        {session.isMerchant ? <Button asChild className="rounded-xl bg-blue-600 text-white"><Link href="/merchant">لوحة التاجر</Link></Button> : null}
        {!session.isAdmin && !session.isMerchant ? <Button asChild className="rounded-xl bg-slate-950 text-white"><Link href="/orders">طلباتي</Link></Button> : null}
        <Button type="button" variant="destructive" className="rounded-xl" onClick={logout} disabled={loggingOut}>
          <LogOut className="h-4 w-4" /> {loggingOut ? "..." : "خروج"}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button asChild className="rounded-xl bg-slate-950 text-white hover:bg-slate-800">
        <Link href="/login"><LogIn className="h-4 w-4" /> {loginLabel}</Link>
      </Button>
      <Button asChild className="hidden rounded-xl bg-gradient-to-l from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/25 hover:from-amber-500 hover:to-orange-600 sm:inline-flex">
        <Link href="/apply-store"><Store className="h-4 w-4" /> {openStoreLabel}</Link>
      </Button>
    </>
  );
}
