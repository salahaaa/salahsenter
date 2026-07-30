import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { AiForecastingPanel } from "@/components/merchant/ai-forecasting-panel";

export default function MerchantAiForecastingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <SiteHeader />
      <AiForecastingPanel />
      <Footer />
    </main>
  );
}
