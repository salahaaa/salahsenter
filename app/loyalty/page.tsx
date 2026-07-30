import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { LoyaltyPortalPanel } from "@/components/customer/loyalty-portal-panel";

export default function MallLoyaltyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <SiteHeader />
      <LoyaltyPortalPanel />
      <Footer />
    </main>
  );
}
