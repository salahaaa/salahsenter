import Link from "next/link";
import { CurrencySettingsForm } from "@/components/merchant/currency-settings-form";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAuth } from "@/lib/auth";
import { getStoreCurrencySettings } from "@/lib/currency";
import { getMerchantPrimaryStore } from "@/lib/db/queries";

export default async function MerchantCurrenciesPage() {
  const session = await requireAuth();
  const store = await getMerchantPrimaryStore(session.userId);
  const settings = store ? await getStoreCurrencySettings(store.id) : null;

  return (
    <main className="min-h-screen merchant-aurora">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950">العملات والتسعير</h1>
            <p className="mt-2 text-sm text-slate-500">سعّر منتجاتك بالعملة الافتراضية، ودع العميل يختار عملة الدفع والتحويل تلقائياً.</p>
          </div>
          <Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button>
        </div>
        {!store || !settings ? <EmptyState title="لا يوجد متجر" /> : <CurrencySettingsForm storeId={store.id} initial={settings} />}
      </section>
    </main>
  );
}
