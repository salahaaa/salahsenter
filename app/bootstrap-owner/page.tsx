import { BootstrapOwnerForm } from "@/components/auth/bootstrap-owner-form";
import { SiteHeader } from "@/components/layout/site-header";

export default function BootstrapOwnerPage() {
  return <main className="min-h-screen bg-slate-50"><SiteHeader/><section className="container max-w-4xl py-12"><BootstrapOwnerForm/></section></main>;
}
