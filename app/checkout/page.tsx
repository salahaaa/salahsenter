export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { MultiStoreCheckout } from "@/components/checkout/multi-store-checkout";
import { requireAuth } from "@/lib/auth";

export default async function CheckoutPage() {
  await requireAuth();
  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">إتمام الشراء</h1>
            <p className="mt-2 text-sm leading-7 text-slate-500">إذا كانت السلة تحتوي منتجات من أكثر من متجر، سيتم إنشاء طلب منفصل لكل متجر مع طريقة دفع وشحن مستقلة.</p>
          </div>
          <Button asChild variant="outline"><Link href="/">متابعة التسوق</Link></Button>
        </div>
        <MultiStoreCheckout />
      </section>
      <Footer />
    </main>
  );
}
