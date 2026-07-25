export const revalidate = 300;

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Layers3, Store } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DatabaseReadinessState } from "@/components/public/database-readiness-state";
import { StoresGrid } from "@/components/home/store-card";
import { ProductsGrid } from "@/components/home/product-card";
import { Badge } from "@/components/ui/badge";
import { getCachedPublicWingPageData } from "@/lib/cache/public-wing-cache";
import { databaseFailureState, getDatabaseReadiness } from "@/lib/database-readiness";
import { StructuredData, breadcrumbJsonLd } from "@/components/seo/structured-data";
import { absolutePublicUrl, cleanDescription } from "@/lib/seo";
import { formatNumber } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCachedPublicWingPageData(slug).catch(() => null);
  if (!data || ("unavailable" in data && data.unavailable)) return { title: "الجناح غير موجود" };
  const title = `${data.wing.name} | أجنحة صلاح سنتر`;
  const description = cleanDescription(data.wing.description, `تسوق متاجر ومنتجات جناح ${data.wing.name}.`);
  const canonical = absolutePublicUrl(`/wings/${data.wing.slug}`);
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, images: data.wing.heroImageUrl ? [{ url: data.wing.heroImageUrl }] : undefined } };
}

export default async function WingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let data: Awaited<ReturnType<typeof getCachedPublicWingPageData>>;
  try {
    data = await getCachedPublicWingPageData(slug);
  } catch (error) {
    console.error("Failed to load cached wing page", error);
    return <WingDataUnavailable state={await databaseFailureState(error)} />;
  }

  if (!data) {
    const readiness = await getDatabaseReadiness();
    if (readiness.state !== "ready") return <WingDataUnavailable state={readiness.state} />;
    notFound();
  }
  if ("unavailable" in data && data.unavailable) return <WingDataUnavailable state={(await getDatabaseReadiness()).state} />;

  const { wing, wingStores, wingProducts } = data;
  const heroImage = wing.heroImageUrl || wing.desktopImageUrl || wing.mobileImageUrl;

  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <StructuredData data={[{ "@context": "https://schema.org", "@type": "CollectionPage", name: `جناح ${wing.name}`, description: cleanDescription(wing.description, `متاجر ومنتجات جناح ${wing.name}`), url: absolutePublicUrl(`/wings/${wing.slug}`) }, breadcrumbJsonLd([{ name: "الرئيسية", url: absolutePublicUrl("/") }, { name: "الأجنحة", url: absolutePublicUrl("/wings") }, { name: wing.name, url: absolutePublicUrl(`/wings/${wing.slug}`) }])]} />

      <section className="relative overflow-hidden bg-slate-950 text-white">
        {heroImage ? <img src={heroImage} alt={wing.name} className="absolute inset-0 h-full w-full object-cover opacity-45" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-900/40" />
        <div className="container relative py-16 md:py-24">
          <Button asChild variant="outline" className="mb-8 border-white/20 bg-white/10 text-white hover:bg-white/20">
            <Link href="/wings">
              <ArrowRight className="h-4 w-4" /> العودة للأجنحة
            </Link>
          </Button>
          <div className="max-w-3xl">
            <Badge className="mb-5 bg-amber-500 text-white">جناح تجاري</Badge>
            <h1 className="text-4xl font-black md:text-6xl">{wing.name}</h1>
            <p className="mt-5 text-base leading-8 text-white/75 md:text-lg">{wing.description || "استكشف المتاجر والمنتجات التابعة لهذا الجناح داخل المول."}</p>
            <div className="mt-8 flex flex-wrap gap-4 text-sm font-bold text-white/80">
              <span className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur"><Store className="ml-2 inline h-4 w-4" /> {formatNumber(wingStores.length)} متجر</span>
              <span className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur"><Layers3 className="ml-2 inline h-4 w-4" /> {formatNumber(wingProducts.length)} منتج</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-10">
        <div className="mb-6 flex flex-col justify-between gap-4 text-right md:flex-row md:items-end">
          <div>
            <h2 className="section-title">متاجر {wing.name}</h2>
            <p className="section-subtitle">المتاجر المعتمدة التابعة لهذا الجناح.</p>
          </div>
          <Button asChild className="rounded-2xl px-7">
            <Link href={`/wings/${wing.slug}/stores`} prefetch={false}>كل المتاجر</Link>
          </Button>
        </div>
        {wingStores.length ? <StoresGrid stores={wingStores} emptyTitle="لا توجد متاجر" /> : <EmptyState title="لا توجد متاجر في هذا الجناح حالياً" description="ستظهر المتاجر هنا بعد اعتمادها وربطها بالجناح من لوحة الأدمن." />}
      </section>

      <section className="container py-10">
        <div className="mb-6 text-right">
          <h2 className="section-title">منتجات {wing.name}</h2>
          <p className="section-subtitle">أحدث وأشهر المنتجات المتاحة داخل هذا الجناح.</p>
        </div>
        {wingProducts.length ? <ProductsGrid products={wingProducts} /> : <EmptyState title="لا توجد منتجات نشطة في هذا الجناح" description="ستظهر المنتجات بعد إضافتها وتفعيلها من لوحة التاجر." />}
      </section>

      <Footer />
    </main>
  );
}

function WingDataUnavailable({ state }: { state: Awaited<ReturnType<typeof getDatabaseReadiness>>["state"] }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <section className="container py-12"><DatabaseReadinessState state={state} /></section>
      <Footer />
    </main>
  );
}
