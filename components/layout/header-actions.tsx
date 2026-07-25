"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, LogOut, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  readAt: string | null;
  createdAt: string;
  data?: Record<string, any>;
};

export function HeaderActions({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const unread = items.filter((item) => !item.readAt).length;

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        const json = await response.json();
        if (active && response.ok) setItems(json.data.notifications || []);
      } catch {
        // تجاهل فشل التنبيهات في رأس الصفحة حتى لا يؤثر على التنقل.
      }
    }
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isAuthenticated]);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark_all_read" }) });
    if (response.ok) setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
  }

  if (!isAuthenticated) return null;

  return (
    <div className="relative flex items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href="/cart"><ShoppingCart className="h-4 w-4" /><span className="hidden sm:inline">السلة</span></Link>
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((value) => !value)} className="relative">
        <Bell className="h-4 w-4" />
        <span className="hidden sm:inline">التنبيهات</span>
        {unread ? <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">{unread}</span> : null}
      </Button>
      <Button type="button" variant="destructive" size="sm" onClick={logout} disabled={loading}>
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">خروج</span>
      </Button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+10px)] z-50 w-[320px] overflow-hidden rounded-3xl border bg-white text-right shadow-2xl md:w-[380px]">
          <div className="flex items-center justify-between border-b bg-slate-950 p-4 text-white">
            <div>
              <p className="font-black">آخر التنبيهات</p>
              <p className="text-xs text-white/55">{unread ? `${unread} غير مقروء` : "لا توجد تنبيهات غير مقروءة"}</p>
            </div>
            <Button type="button" size="sm" variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={markAllRead}>قراءة الكل</Button>
          </div>
          <div className="max-h-96 overflow-auto p-3">
            {items.length ? items.slice(0, 8).map((item) => {
              const href = typeof item.data?.url === "string" ? item.data.url : null;
              const content = <><div className="flex items-start justify-between gap-2"><h3 className="font-black text-slate-900">{item.title}</h3>{!item.readAt ? <Badge variant="warning">جديد</Badge> : null}</div>{item.body ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.body}</p> : null}<p className="mt-2 text-[11px] font-bold text-slate-400">{new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.createdAt))}</p></>;
              return href ? <Link key={item.id} href={href} className="mb-2 block rounded-2xl border bg-slate-50 p-3 transition hover:bg-blue-50" onClick={() => setOpen(false)}>{content}</Link> : <article key={item.id} className="mb-2 rounded-2xl border bg-slate-50 p-3">{content}</article>;
            }) : <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm font-bold text-slate-400">لا توجد تنبيهات</p>}
          </div>
          <div className="border-t p-3"><Button asChild variant="outline" size="sm" className="w-full"><Link href="/notifications">فتح مركز التنبيهات</Link></Button></div>
        </div>
      ) : null}
    </div>
  );
}
