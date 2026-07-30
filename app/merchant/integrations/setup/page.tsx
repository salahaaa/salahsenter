import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { ErpSetupPanel } from "@/components/merchant/erp-setup-panel";

export default function MerchantErpSetupPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <SiteHeader />
      <ErpSetupPanel />
      <Footer />
    </main>
  );
}
