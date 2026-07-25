"use client";

import { GitCompareArrows } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addComparisonProducts } from "@/lib/discovery/product-comparison-client";

export function ProductCompareButton({ productId, withProductId, compact = false }: { productId: string; withProductId?: string; compact?: boolean }) {
  const router = useRouter();
  function compare() {
    const ids = addComparisonProducts(productId, ...(withProductId ? [withProductId] : []));
    if (ids.length >= 2) router.push(`/compare?products=${encodeURIComponent(ids.join(","))}`);
  }
  return <Button type="button" size={compact ? "sm" : "default"} variant="outline" onClick={compare}><GitCompareArrows className="h-4 w-4" /> {withProductId ? "قارن" : "أضف للمقارنة"}</Button>;
}
