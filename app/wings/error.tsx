"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WingsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Wings route error", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-xl rounded-[2rem] border bg-white p-8 text-center shadow-card">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-amber-50 text-amber-600"><AlertTriangle className="h-8 w-8" /></div>
        <h1 className="text-2xl font-black text-slate-950">تعذر تحميل الأجنحة مؤقتاً</h1>
        <p className="mt-3 text-sm leading-7 text-slate-500">تمت حماية الصفحة من الانهيار. جرّب إعادة المحاولة أو العودة للرئيسية.</p>
        {error.digest ? <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-400">Digest: {error.digest}</p> : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}><RotateCcw className="h-4 w-4" /> إعادة المحاولة</Button>
          <Button type="button" variant="outline" onClick={() => window.location.assign("/")}>الرئيسية</Button>
        </div>
      </div>
    </main>
  );
}
