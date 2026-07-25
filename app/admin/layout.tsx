import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Admin screens require live authorization and database state; never prerender them at build time. */
export default function AdminRouteLayout({ children }: { children: ReactNode }) {
  return children;
}
