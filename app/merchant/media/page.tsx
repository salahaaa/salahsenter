import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { MediaForm } from "@/components/merchant/media-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";

export default async function MerchantMediaPage() {
  const session = await requireAuth();
  const store = await getMerchantPrimaryStore(session.userId);

  return (
    <main className="min-h-screen merchant-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">وسائط المتجر</h1>
            <p className="mt-2 text-sm text-slate-500">صورة الغلاف، الشعار، الصورة التعريفية، المعرض والفيديو التعريفي.</p>
          </div>
          <Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button>
        </div>
        {store ? <MediaForm storeId={store.id} /> : <EmptyState title="لا يوجد متجر" />}
      </section>
    </main>
  );
}
