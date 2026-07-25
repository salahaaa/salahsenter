export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { ServerCartManager } from "@/components/cart/server-cart-manager";
import { requireAuth } from "@/lib/auth";

export default async function CartPage() {
  await requireAuth();
  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">السلة</h1>
            <p className="mt-2 text-sm leading-7 text-slate-500">سلة محفوظة على الخادم، متزامنة مع جهازك، ومقسمة لاحقاً حسب المتجر عند إتمام الشراء.</p>
          </div>
          <Button asChild variant="outline"><Link href="/">متابعة التسوق</Link></Button>
        </div>
        <ServerCartManager />
      </section>
      <Footer />
    </main>
  );
}
