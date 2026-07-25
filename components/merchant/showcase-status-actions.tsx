"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ShowcaseStatusActions({ productId, status }: { productId: string; status?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const current = status || "AVAILABLE";

  async function update(showcaseStatus: "AVAILABLE" | "SOLD" | "HIDDEN") {
    setLoading(true);
    const response = await fetch(`/api/merchant/products/${productId}/showcase-status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ showcaseStatus }) });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) window.alert(json.message || "تعذر تحديث حالة العرض");
    else { setOpen(false); router.refresh(); }
  }

  return (
    <div className="relative inline-flex flex-col gap-2">
      {current === "SOLD" ? <Badge variant="danger">تم البيع</Badge> : current === "HIDDEN" ? <Badge variant="outline">مخفي</Badge> : null}
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen((value) => !value)} disabled={loading}>تم البيع</Button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-2xl border bg-white p-2 text-right shadow-2xl">
          <button type="button" onClick={() => update("SOLD")} className="block w-full rounded-xl px-3 py-2 text-sm font-bold hover:bg-red-50 hover:text-red-700">إظهار مع شارة تم البيع</button>
          <button type="button" onClick={() => update("HIDDEN")} className="block w-full rounded-xl px-3 py-2 text-sm font-bold hover:bg-slate-50">إخفاء المنتج من المتجر</button>
          {current !== "AVAILABLE" ? <button type="button" onClick={() => update("AVAILABLE")} className="block w-full rounded-xl px-3 py-2 text-sm font-bold hover:bg-emerald-50 hover:text-emerald-700">إعادة متاح</button> : null}
        </div>
      ) : null}
    </div>
  );
}
