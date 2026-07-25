"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot } from "lucide-react";

const AIShoppingAssistant = dynamic(
  () => import("@/components/assistant/ai-shopping-assistant").then((mod) => mod.AIShoppingAssistant),
  {
    ssr: false,
    loading: () => null
  }
);

const hiddenPrefixes = ["/admin", "/merchant", "/login", "/forgot-password", "/reset-password"];

type AssistantIntent = "chat" | "visual";

export function LazyAIShoppingAssistant() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [intent, setIntent] = useState<AssistantIntent>("chat");
  const [trigger, setTrigger] = useState(0);
  const shouldHide = hiddenPrefixes.some((prefix) => pathname?.startsWith(prefix));

  useEffect(() => {
    function openAssistant(event: Event) {
      const detail = (event as CustomEvent<{ mode?: AssistantIntent }>).detail;
      setIntent(detail?.mode === "visual" ? "visual" : "chat");
      setEnabled(true);
      setTrigger((value) => value + 1);
    }
    window.addEventListener("salah-center-open-assistant", openAssistant);
    return () => window.removeEventListener("salah-center-open-assistant", openAssistant);
  }, []);

  if (shouldHide) return null;
  if (enabled) return <AIShoppingAssistant key={trigger} initialOpen initialMode={intent} />;

  return (
    <button
      type="button"
      onClick={() => setEnabled(true)}
      className="fixed bottom-5 left-5 z-50 flex items-center gap-3 rounded-full bg-slate-950 px-5 py-4 text-white shadow-2xl shadow-slate-900/25 transition hover:-translate-y-1 print:hidden"
      aria-label="تشغيل مساعد التسوق الذكي"
    >
      <span className="relative grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950">
        <Bot className="h-6 w-6" />
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
      </span>
      <span className="hidden text-right sm:block">
        <span className="block text-sm font-black">مساعد التسوق الذكي</span>
        <span className="block text-xs text-white/55">يعمل عند النقر لتوفير البيانات</span>
      </span>
    </button>
  );
}
