export const revalidate = 300;

import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { WingsGrid } from "@/components/home/wing-card";
import { DatabaseReadinessState } from "@/components/public/database-readiness-state";
import { Button } from "@/components/ui/button";
import { getCachedPublicWingsPageData } from "@/lib/cache/public-wings-cache";
import { databaseFailureState, getDatabaseReadiness } from "@/lib/database-readiness";

export default async function WingsPage() {
  let wingItems: Awaited<ReturnType<typeof getCachedPublicWingsPageData>> = [];
  let failureState: Awaited<ReturnType<typeof getDatabaseReadiness>>["state"] | null = null;
  try {
    wingItems = await getCachedPublicWingsPageData();
  } catch (error) {
    console.error("Failed to load cached wings page", error);
    failureState = await databaseFailureState(error);
  }
  const readiness = await getDatabaseReadiness();

  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <section className="container py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-950 md:text-5xl">أجنحة المول</h1>
            <p className="mt-3 text-sm leading-7 text-slate-500">تصفح الأجنحة التجارية ثم ادخل للجناح لاستعراض المتاجر والمنتجات التابعة له.</p>
          </div>
          <Button asChild variant="outline"><Link href="/" prefetch={false}>الرئيسية</Link></Button>
        </div>
        {failureState || readiness.state !== "ready" ? <DatabaseReadinessState state={failureState || readiness.state} /> : <WingsGrid wings={wingItems} />}
      </section>
      <Footer />
    </main>
  );
}
