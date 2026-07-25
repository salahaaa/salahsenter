export const revalidate = 300;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { ProductDetail } from "@/components/product/product-detail";
import { ProductDiscoverySection } from "@/components/product/product-discovery-section";
import { StructuredData, breadcrumbJsonLd } from "@/components/seo/structured-data";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { getCurrentSession, hasStoreAccess } from "@/lib/auth";
import { assertTenantStoreMembership, getRequestTenantContext } from "@/lib/tenancy/context";
import { getCachedPublicProductPageData, getFreshPreviewProductPageData } from "@/lib/cache/public-product-cache";
import { absolutePublicUrl, cleanDescription } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productSlug: string }> }): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const data = await getCachedPublicProductPageData(slug, productSlug).catch(() => null);
  if (!data) return { title: "المنتج غير موجود" };
  const title = `${data.product.name} | ${data.store.name}`;
  const description = cleanDescription(data.product.shortDescription || data.product.description, `تسوق ${data.product.name} من ${data.store.name}.`);
  const canonical = absolutePublicUrl(`/store/${data.store.slug}/products/${data.product.slug}`);
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: canonical, images: data.product.mainImageUrl ? [{ url: data.product.mainImageUrl }] : undefined }, twitter: { card: "summary_large_image", title, description } };
}

export default async function PublicProductPage({ params, searchParams }: { params: Promise<{ slug: string; productSlug: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { slug, productSlug } = await params;
  const { preview: previewParam } = await searchParams;
  const isPreview = previewParam === "1" || previewParam === "true";
  if (isPreview) noStore();

  const data = isPreview ? await getFreshPreviewProductPageData(slug, productSlug) : await getCachedPublicProductPageData(slug, productSlug);
  if (!data) notFound();
  const tenantContext = await getRequestTenantContext();
  if (tenantContext) {
    try { assertTenantStoreMembership(tenantContext, data.store.id); } catch { notFound(); }
  }

  if (isPreview) {
    const session = await getCurrentSession();
    if (!hasStoreAccess(session, data.store.id)) notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      {!isPreview ? <StructuredData data={[{ "@context": "https://schema.org", "@type": "Product", name: data.product.name, description: cleanDescription(data.product.shortDescription || data.product.description, data.product.name), image: [data.product.mainImageUrl, ...(data.product.images || [])].filter(Boolean), sku: data.variants[0]?.sku || undefined, brand: data.product.brand ? { "@type": "Brand", name: data.product.brand } : undefined, aggregateRating: data.product.ratingCount > 0 ? { "@type": "AggregateRating", ratingValue: Number(data.product.ratingAverage || 0), reviewCount: data.product.ratingCount } : undefined, offers: { "@type": "Offer", url: absolutePublicUrl(`/store/${data.store.slug}/products/${data.product.slug}`), priceCurrency: data.currencySettings.defaultCurrency || "YER", price: String(data.variants[0]?.price || data.product.basePrice || 0), availability: data.variants.some((variant) => variant.stockQuantity > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", seller: { "@type": "Organization", name: data.store.name } } }, breadcrumbJsonLd([{ name: "الرئيسية", url: absolutePublicUrl("/") }, { name: data.store.name, url: absolutePublicUrl(`/store/${data.store.slug}`) }, { name: data.product.name, url: absolutePublicUrl(`/store/${data.store.slug}/products/${data.product.slug}`) }])]} /> : null}
      <section className="container py-8">
        {isPreview ? <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-800">وضع معاينة التاجر: هذا المنتج يظهر لك حتى لو كان غير منشور للمتسوقين. الحالة الحالية: <Badge variant="warning">{data.product.status}</Badge></div> : null}
        <ProductDetail
          product={data.product}
          variants={data.variants}
          images={data.images}
          store={{ id: data.store.id, name: data.store.name, slug: data.store.slug, contactPhone: data.store.contactPhone, whatsappUrl: getWhatsappUrl(data.store.socialLinks, data.store.contactPhone), storeCommerceType: data.store.storeCommerceType }}
          colorMap={data.colorMap}
          valueImageMap={data.valueImageMap}
          currencySettings={data.currencySettings}
        />
        {!isPreview ? <ProductDiscoverySection productId={data.product.id} storeId={data.store.id} currencySettings={data.currencySettings} /> : null}
      </section>
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
