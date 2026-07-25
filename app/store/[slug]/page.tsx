export const revalidate = 300;

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { Gift, MapPin, MessageCircle, Phone, Star, Tag } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatabaseReadinessState } from "@/components/public/database-readiness-state";
import { StorefrontExperience } from "@/components/store/storefront-experience";
import { StoreDesignShowcase } from "@/components/store/store-design-showcase";
import { StoreMerchantQuickActions } from "@/components/store/store-merchant-quick-actions";
import { ProductMediaFrame } from "@/components/product/product-media-frame";
import { StructuredData, breadcrumbJsonLd } from "@/components/seo/structured-data";
import { getCurrentSession, hasStoreAccess } from "@/lib/auth";
import { assertTenantStoreMembership, getRequestTenantContext } from "@/lib/tenancy/context";
import { getCachedPublicStorePageData, getCachedStoreSelectedOffer, getFreshPreviewStorePageData, getFreshPreviewStoreSelectedOffer } from "@/lib/cache/public-store-cache";
import { databaseFailureState, getDatabaseReadiness } from "@/lib/database-readiness";
import { formatNumber, getInitials } from "@/lib/utils";
import { absolutePublicUrl, cleanDescription } from "@/lib/seo";
import { CurrencyPrice } from "@/components/currency/currency-price";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCachedPublicStorePageData(slug).catch(() => null);
  if (!data) return { title: "المتجر غير موجود" };
  const title = `${data.store.name} | صلاح سنتر`;
  const description = cleanDescription(data.store.description, `تسوق منتجات وعروض ${data.store.name}.`);
  const canonical = absolutePublicUrl(`/store/${data.store.slug}`);
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, images: data.store.coverImageUrl ? [{ url: data.store.coverImageUrl }] : undefined }, twitter: { card: "summary_large_image", title, description } };
}

export default async function StorePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string; offer?: string }> }) {
  const { slug } = await params;
  const { preview: previewParam, offer: offerId } = await searchParams;
  const isPreview = previewParam === "1" || previewParam === "true";
  if (isPreview) noStore();

  let data: Awaited<ReturnType<typeof getCachedPublicStorePageData>>;
  try {
    data = isPreview ? await getFreshPreviewStorePageData(slug) : await getCachedPublicStorePageData(slug);
  } catch (error) {
    console.error("Failed to load public store page", error);
    return <StoreDataUnavailable state={await databaseFailureState(error)} />;
  }
  if (!data) {
    const readiness = await getDatabaseReadiness();
    if (readiness.state !== "ready") return <StoreDataUnavailable state={readiness.state} />;
    notFound();
  }
  const tenantContext = await getRequestTenantContext();
  if (tenantContext) {
    try { assertTenantStoreMembership(tenantContext, data.store.id); } catch { notFound(); }
  }

  const session = isPreview ? await getCurrentSession() : null;
  const isStoreManager = hasStoreAccess(session, data.store.id);
  if (isPreview && !isStoreManager) notFound();

  const selectedOffer = offerId
    ? isPreview
      ? await getFreshPreviewStoreSelectedOffer(data.store.id, offerId)
      : await getCachedStoreSelectedOffer(data.store.id, data.store.slug, offerId)
    : [];

  const coverFallback = data.defaultMedia.find((media) => ["cover", "banner"].includes(media.mediaType))?.url;
  const logoFallback = data.defaultMedia.find((media) => media.mediaType === "logo")?.url;
  const coverUrl = data.store.coverImageUrl || coverFallback;
  const logoUrl = data.store.logoUrl || logoFallback;

  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <StructuredData data={[{ "@context": "https://schema.org", "@type": "Organization", name: data.store.name, url: absolutePublicUrl(`/store/${data.store.slug}`), logo: logoUrl || undefined, image: coverUrl || undefined, telephone: data.store.contactPhone || undefined }, breadcrumbJsonLd([{ name: "الرئيسية", url: absolutePublicUrl("/") }, { name: data.store.name, url: absolutePublicUrl(`/store/${data.store.slug}`) }])]} />
      <section className="container py-8">
        {isPreview ? <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-800">وضع معاينة التاجر: يمكنك رؤية المتجر كما سيظهر للمتسوقين، مع عرض المنتجات غير المنشورة أيضاً لأغراض المراجعة.</div> : null}
        <div className="overflow-hidden rounded-[2rem] border bg-white shadow-soft">
          <div className="relative h-72 bg-slate-100 md:h-96">
            {coverUrl ? (
              <img src={coverUrl} alt={data.store.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm font-bold text-slate-400">لم يتم رفع صورة غلاف لهذا المتجر بعد</div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
            <div className="absolute bottom-6 right-6 flex flex-col gap-4 text-white md:flex-row md:items-end">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-white text-primary shadow-soft">
                {logoUrl ? <img src={logoUrl} alt={`شعار ${data.store.name}`} className="h-full w-full object-cover" /> : <span className="text-3xl font-black">{getInitials(data.store.name)}</span>}
              </div>
              <div>
                <h1 className="text-4xl font-black md:text-5xl">{data.store.name}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-bold text-slate-100">
                  <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {[data.store.countryName, data.store.governorateName, data.store.cityName].filter(Boolean).join("، ") || "الموقع غير محدد"}</span>
                  <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-current text-amber-400" /> {formatNumber(data.store.ratingAverage)} ({formatNumber(data.store.ratingCount)} تقييم)</span>
                  <span>{formatNumber(data.store.orderCount)} طلب</span>
                  {data.store.contactPhone ? <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {data.store.contactPhone}</span> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.store.contactPhone ? <a href={`tel:${data.store.contactPhone}`} className="rounded-full bg-white/15 px-4 py-2 text-sm font-black text-white backdrop-blur transition hover:bg-white/25">اتصال مباشر</a> : null}
                  {getWhatsappUrl(data.store.socialLinks, data.store.contactPhone) ? <a href={getWhatsappUrl(data.store.socialLinks, data.store.contactPhone)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-white shadow-lg shadow-emerald-500/20"><MessageCircle className="h-4 w-4" /> واتساب</a> : null}
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
            <p className="max-w-4xl text-sm leading-8 text-slate-600">{data.store.description || "لم يضف التاجر وصفاً للمتجر بعد."}</p>
            <Button asChild variant="outline"><Link href="/merchant">لوحة التاجر</Link></Button>
          </div>
        </div>
      </section>

      {isStoreManager ? <StoreMerchantQuickActions /> : null}

      <StorefrontExperience
        store={{ id: data.store.id, name: data.store.name, slug: data.store.slug, description: data.store.description, coverImageUrl: coverUrl, contactPhone: data.store.contactPhone, whatsappUrl: getWhatsappUrl(data.store.socialLinks, data.store.contactPhone), storeCommerceType: data.store.storeCommerceType, operationStatus: data.store.operationStatus, operationNote: data.store.operationNote, businessHours: data.store.businessHours, ratingAverage: data.store.ratingAverage, orderCount: data.store.orderCount }}
        gallery={data.gallery}
        announcements={data.announcements}
        news={data.news}
        categories={data.categories}
        products={data.products}
        offers={data.storeOffers}
        currencySettings={data.currencySettings}
        isPreview={isPreview}
      />

      <StoreDesignShowcase design={data.storeDesign} categories={data.categories} products={data.products} storeSlug={data.store.slug} />

      {selectedOffer.length ? (
        <section className="container py-6">
          <div className="overflow-hidden rounded-[2rem] border bg-white shadow-card">
            <div className="bg-gradient-to-l from-amber-500 to-orange-500 p-6 text-white">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-black"><Gift className="h-4 w-4" /> العرض المختار</div>
                  <h2 className="text-3xl font-black">{selectedOffer[0].offer.title}</h2>
                  <p className="mt-2 text-sm font-bold text-white/80">{selectedOffer[0].offer.description || "يمكنك شراء منتجات هذا العرض من المتجر كأي منتج عادي."}</p>
                </div>
                <Badge className="bg-white text-orange-600">{selectedOffer.length} منتج</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 sm:gap-4 sm:p-6 md:grid-cols-3">
              {selectedOffer.map(({ item, product }) => (
                <Link key={item.id} href={`/store/${data.store.slug}/products/${product.slug}${isPreview ? "?preview=1" : ""}`} className="overflow-hidden rounded-[1.35rem] border bg-slate-50 transition hover:-translate-y-1 hover:shadow-soft">
                  <ProductMediaFrame src={item.imageUrl || product.mainImageUrl} alt={item.title || product.name} className="aspect-[4/5]" imageClassName="p-2" />
                  <div className="p-3 sm:p-4">
                    <h3 className="line-clamp-2 font-black text-slate-950">{item.title || product.name}</h3>
                    <div className="mt-3 flex items-center justify-between">
                      <CurrencyPrice amount={item.offerPrice || product.basePrice} settings={data.currencySettings} className="font-black text-orange-600" />
                      {item.originalPrice ? <CurrencyPrice amount={item.originalPrice} settings={data.currencySettings} className="text-xs font-bold text-slate-400 line-through" /> : null}
                    </div>
                    <div className="mt-3 text-xs font-bold text-primary"><Tag className="ml-1 inline h-3 w-3" /> شراء المنتج</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <Footer />
    </main>
  );
}

function StoreDataUnavailable({ state }: { state: Awaited<ReturnType<typeof getDatabaseReadiness>>["state"] }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <section className="container py-12"><DatabaseReadinessState state={state} /></section>
      <Footer />
    </main>
  );
}

function getWhatsappUrl(socialLinks: Record<string, string> | null | undefined, phone?: string | null) {
  const raw = socialLinks?.whatsapp || phone || "";
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}
