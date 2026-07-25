"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ProductRowActions({ productId, editHref }: { productId: string; editHref: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function remove() {
    if (!window.confirm("سيتم حذف الصنف فقط إذا لم تكن عليه طلبات أو حركات مخزون. هل تريد المتابعة؟")) return;
    setLoading(true);
    const response = await fetch(`/api/merchant/products/${productId}`, { method: "DELETE" });
    const json = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      window.alert(json.message || "تعذر حذف الصنف");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant="outline"><Link href={editHref}>تعديل</Link></Button>
      <Button type="button" size="sm" variant="destructive" onClick={remove} disabled={loading}>{loading ? "..." : "حذف"}</Button>
    </div>
  );
}
