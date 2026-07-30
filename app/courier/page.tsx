import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { CourierPortalPanel } from "@/components/courier/courier-portal-panel";

export default function CourierPortalPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <SiteHeader />
      <CourierPortalPanel />
      <Footer />
    </main>
  );
}
