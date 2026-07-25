export type BundleComponent = {
  productId: string;
  variantId: string | null;
  title?: string | null;
  quantity: number;
  originalPrice?: string | number | null;
  offerPrice?: string | number | null;
};

export function normalizeBundleQuantity(value: unknown, fallback = 1) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function calculateBundleRestoration(items: BundleComponent[], bundleQuantity: number) {
  const bundles = normalizeBundleQuantity(bundleQuantity, 0);
  if (bundles <= 0) return [];
  return items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    title: item.title || "",
    perBundleQuantity: normalizeBundleQuantity(item.quantity),
    restoreQuantity: normalizeBundleQuantity(item.quantity) * bundles
  }));
}

export function calculateBundleTotals(items: BundleComponent[]) {
  return items.reduce((totals, item) => {
    const quantity = normalizeBundleQuantity(item.quantity);
    totals.original += Number(item.originalPrice || 0) * quantity;
    totals.offer += Number(item.offerPrice || 0) * quantity;
    totals.quantity += quantity;
    return totals;
  }, { original: 0, offer: 0, quantity: 0 });
}
