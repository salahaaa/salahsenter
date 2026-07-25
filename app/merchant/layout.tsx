import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Merchant screens require live authorization and store-scoped operational data. */
export default function MerchantRouteLayout({ children }: { children: ReactNode }) {
  return children;
}
