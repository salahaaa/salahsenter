import Link from "next/link";
import { ArrowLeft, Bell, Building2, Gift, Headphones, Heart, Home, Layers3, Menu, RotateCcw, Search, ShieldCheck, ShoppingCart, Star, Tag, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber, getInitials } from "@/lib/utils";
import { defaultHomeSections, normalizeHomeSectionCode } from "@/lib/home-layout";
import { defaultHomeContent, type HomeContentSettings, normalizeHomeContent } from "@/lib/home-content";
import { defaultWelcomePopup, type WelcomePopupSettings } from "@/lib/welcome-popup";
import { PromoCarousel, WelcomePopup } from "@/components/home/promo-carousel";
import { PublicAuthActions } from "@/components/layout/public-auth-actions";
import { HomeDiscoveryZone } from "@/components/home/home-discovery-zone";
import { SmartSearchBox } from "@/components/search/smart-search-box";
import { StoreMarquee } from "@/components/home/store-marquee";
import { SmartMallExperience } from "@/components/home/smart-mall-experience";
import { SponsoredAdTracker } from "@/components/ads/sponsored-ad-tracker";
import { MerchantSponsoredBanner } from "@/components/ads/merchant-sponsored-banner";
import { HomeExposureSlot } from "@/components/home/home-exposure-slot";
import { isCustomHomeSectionType, normalizeCustomHomeSectionConfig } from "@/lib/home-section-templates";
import type { PlatformIdentity } from "@/lib/platform-identity";
import { defaultHomeVisibilityRules, type HomeVisibilityRules } from "@/lib/home-visibility";
import { buildLatestHomeCards } from "@/lib/home/latest-cards";

type AnyRecord = Record<string, any>;

type HomeSection = { id?: string; code: string; title: string; type: string; isVisible: boolean; sortOrder: number; config?: Record<string, unknown> };

type LuxuryHomeData = {
  homeSections?: HomeSection[];
  homeContent?: Partial<HomeContentSettings>;
  welcomePopup?: WelcomePopupSettings;
  banners: AnyRecord[];
  marketplaceNews: AnyRecord[];
  marketplaceAnnouncements: AnyRecord[];
  promotedOffers: AnyRecord[];
  seasonalOffers?: AnyRecord[];
  wings: AnyRecord[];
  visibilityRules?: HomeVisibilityRules;
  latestStores: AnyRecord[];
  trendingStores: AnyRecord[];
  trendingProducts: AnyRecord[];
  latestAdditions?: AnyRecord[];
  sponsoredProducts?: AnyRecord[];
  homeExposures?: Record<string, AnyRecord[]>;
  homeLayoutManaged?: boolean;
};

const fallbackImages = {
  mall: "https://images.unsplash.com/photo-1519567241046-7f570eee3ce6?auto=format&fit=crop&w=1800&q=85",
  gift: "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=1400&q=85",
  fashion: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=85",
  electronics: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=85",
  perfume: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=85",
  computers: "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=900&q=85"
};

export function LuxuryMarketplaceHome({ data, identity }: { data: LuxuryHomeData; identity?: PlatformIdentity }) {
  const baseContent = normalizeHomeContent(data.homeContent || defaultHomeContent);
  const content = identity ? { ...baseContent, platformName: identity.platformName || baseContent.platformName, platformSubtitle: identity.tagline || baseContent.platformSubtitle, logoLetter: identity.shortName || baseContent.logoLetter, openStoreLabel: identity.header.openStoreLabel || baseContent.openStoreLabel, contactPhone: identity.contactPhone || baseContent.contactPhone, contactEmail: identity.officialEmail || baseContent.contactEmail, whatsappUrl: identity.whatsappUrl || baseContent.whatsappUrl, facebookUrl: identity.facebookUrl || baseContent.facebookUrl, instagramUrl: identity.instagramUrl || baseContent.instagramUrl } : baseContent;
  const news = data.marketplaceNews?.length ? data.marketplaceNews : [{ id: "system-status", title: "تصفح المتاجر والأجنحة المنشورة عند توفرها." }];
  const heroBanners = (data.banners || []).filter((banner) => banner.placement === "homepage_hero");
  const promoBanners = (data.banners || []).filter((banner) => ["homepage_promo", "homepage_offer", "homepage_slider"].includes(banner.placement));
  const heroImage = content.heroBackgroundImage || heroBanners?.[0]?.imageUrl || data.banners?.[0]?.imageUrl || fallbackImages.mall;
  const promoSlides = buildPromoSlides(promoBanners.length ? promoBanners : data.marketplaceAnnouncements, data.banners?.[1]);
  const visibilityRules = data.visibilityRules || defaultHomeVisibilityRules;
  const realStores = uniqueRecordsById([...(data.trendingStores || []), ...(data.latestStores || [])]);
  // Public cards must represent records that actually exist in the active
  // catalogue. Decorative images remain as visual fallbacks only; invented
  // store/wing slugs would produce broken public links.
  const featuredStores = visibilityRules.stores.limit > 0 ? realStores.slice(0, 3) : [];
  const allStores = realStores;
  const featuredStoreIds = new Set(featuredStores.map((store) => store.id || store.slug));
  const marqueeStores = allStores.filter((store) => !featuredStoreIds.has(store.id || store.slug));
  const wings = data.wings || [];
  const latestCards = buildLatestCards(data, wings);
  const sections = resolveHomeSections(data.homeSections || [], Boolean(data.homeLayoutManaged));

  const smartMallStores = realStores;
  const smartMallProducts = uniqueRecordsById([...(data.trendingProducts || []), ...(data.latestAdditions || []), ...(data.promotedOffers || [])]);
  const smartMallOffers = data.seasonalOffers || [];
  const context = { data, content, news, heroImage, promoSlides, featuredStores, marqueeStores, smartMallStores, smartMallProducts, smartMallOffers, wings, visibilityRules, latestCards, homeExposures: data.homeExposures || {} };

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <WelcomePopup settings={data.welcomePopup || defaultWelcomePopup} />
      {sections.map((section) => <HomeSectionRenderer key={section.code} section={section} context={context} />)}
      <MobileMarketplaceDock />
    </main>
  );
}

function resolveHomeSections(dbSections: HomeSection[], managed = false) {
  const byCode = new Map<string, HomeSection>();
  if (!managed) for (const section of defaultHomeSections) byCode.set(section.code, section);
  for (const section of dbSections) {
    const normalizedCode = normalizeHomeSectionCode(section.code);
    byCode.set(normalizedCode, { ...section, code: normalizedCode, type: normalizeHomeSectionCode(section.type) });
  }
  return [...byCode.values()].filter((section) => section.isVisible).sort((a, b) => a.sortOrder - b.sortOrder);
}

function HomeSectionRenderer({ section, context }: { section: HomeSection; context: ReturnType<typeof buildHomeContext> }) {
  const code = normalizeHomeSectionCode(section.code);
  if (!isHomeSectionEnabled(code, context.visibilityRules)) return null;
  switch (code) {
    case "top_news":
      return <TopNewsBar news={context.news} label="تسوق ذكي • شحن سريع • جودة مضمونة • عروض يومية" />;
    case "header":
    case "navbar":
      return <LuxuryNavbar content={context.content} />;
    case "hero":
      return (
        <>
          <HeroSection image={context.heroImage} content={context.content} />
          <HomeExposureSlot placement="homepage_hero" cards={context.homeExposures.homepage_hero as any} label="البنر التجاري الرئيسي" />
          <MallTrustStrip />
          {(context.visibilityRules.sections || defaultHomeVisibilityRules.sections).smartMallShortcuts ? <SmartMallExperience wings={context.wings} stores={context.smartMallStores} products={context.smartMallProducts} offers={context.smartMallOffers} /> : null}
        </>
      );
    case "promo_banners":
      return <><HomeExposureSlot placement="homepage_promo" cards={context.homeExposures.homepage_promo as any} label="عروض وبنرات مجدولة" /><PromoCarousel promos={context.promoSlides} primaryButton={context.content.promoPrimaryButton} secondaryButton={context.content.promoSecondaryButton} /></>;
    case "seasonal_offers":
      return <><HomeExposureSlot placement="homepage_today_offers" cards={context.homeExposures.homepage_today_offers as any} label="عروض اليوم" /><HomeExposureSlot placement="homepage_weekend_offers" cards={context.homeExposures.homepage_weekend_offers as any} label="عروض نهاية الأسبوع" /><HomeExposureSlot placement="homepage_seasonal_offers" cards={context.homeExposures.homepage_seasonal_offers as any} label="عروض موسمية" /><SeasonalOffersWindow title={section.title || "العروض"} offers={context.data.seasonalOffers || []} /></>;
    case "featured_stores":
      return <><HomeExposureSlot placement="homepage_featured_stores" cards={context.homeExposures.homepage_featured_stores as any} label="متاجر مميزة ممولة" /><FeaturedStores stores={context.featuredStores} marqueeStores={context.marqueeStores} title={section.title || "المتاجر المميزة"} content={context.content} /></>;
    case "featured_wings":
      return <><HomeExposureSlot placement="homepage_featured_wings" cards={context.homeExposures.homepage_featured_wings as any} label="أجنحة وأقسام ممولة" /><WingsDiscovery wings={context.wings} title={section.title || "استكشف أجنحة المول"} content={context.content} visibilityRules={context.visibilityRules} /></>;
    case "marketplace_ads":
      return <><HomeExposureSlot placement="homepage_marketplace_ads" cards={context.homeExposures.homepage_marketplace_ads as any} label="مساحة إعلانات المول" /><MarketplaceAdsSection announcements={context.data.marketplaceAnnouncements || []} title={section.title || "إعلانات المول العامة"} /></>;
    case "promoted_offers":
      return <><HomeExposureSlot placement="homepage_promoted_offers" cards={context.homeExposures.homepage_promoted_offers as any} label="عروض مميزة ممولة" /><HomeExposureSlot placement="homepage_sponsored_products" cards={context.homeExposures.homepage_sponsored_products as any} label="منتجات ممولة" /><SponsoredProductsShowcase products={context.data.sponsoredProducts || []} /><ProductShowcase title={section.title || "عروض مميزة"} products={context.data.promotedOffers || []} emptyText="لا توجد عروض ممولة حالياً" content={context.content} /></>;
    case "trending_products":
      return <><HomeExposureSlot placement="homepage_featured_products" cards={context.homeExposures.homepage_featured_products as any} label="منتجات مميزة ممولة" /><HomeExposureSlot placement="homepage_trending_products" cards={context.homeExposures.homepage_trending_products as any} label="منتجات رائجة ممولة" /><ProductShowcase title={section.title || "المنتجات الرائجة"} products={context.data.trendingProducts || []} emptyText="لا توجد منتجات رائجة حالياً" content={context.content} /></>;
    case "trending_stores":
      return <><HomeExposureSlot placement="homepage_trending_stores" cards={context.homeExposures.homepage_trending_stores as any} label="متاجر رائجة ممولة" /><FeaturedStores stores={context.data.trendingStores?.length ? context.data.trendingStores : context.featuredStores} marqueeStores={context.marqueeStores} title={section.title || "المتاجر الرائجة"} content={context.content} /></>;
    case "latest_additions":
      return <><HomeExposureSlot placement="homepage_latest_stores" cards={context.homeExposures.homepage_latest_stores as any} label="أحدث المتاجر ممولة" /><HomeExposureSlot placement="homepage_latest_products" cards={context.homeExposures.homepage_latest_products as any} label="أحدث المنتجات ممولة" /><LatestAdditions cards={context.latestCards} title={section.title || context.content.latestTitle} content={context.content} /></>;
    case "merchant_cta":
      return <MerchantCta content={context.content} />;
    case "footer":
      return <HomeFooter content={context.content} />;
    default:
      return <CustomHomeSection section={section} />;
  }
}

function isHomeSectionEnabled(code: string, rules: HomeVisibilityRules) {
  const sectionRules = rules.sections || defaultHomeVisibilityRules.sections;
  const map: Record<string, boolean> = {
    featured_stores: sectionRules.featuredStores,
    trending_stores: sectionRules.trendingStores,
    trending_products: sectionRules.trendingProducts && rules.products.showTrending,
    latest_additions: sectionRules.latestAdditions && rules.latestAdditions.enabled,
    promoted_offers: sectionRules.promotedOffers,
    seasonal_offers: sectionRules.seasonalOffers && rules.offers.enabled,
    featured_wings: sectionRules.featuredWings,
    marketplace_ads: sectionRules.marketplaceAds,
    hero: true,
    header: true,
    navbar: true,
    top_news: true,
    promo_banners: true,
    merchant_cta: true,
    footer: true
  };
  return map[code] ?? true;
}

function buildHomeContext() {
  return {} as {
    data: LuxuryHomeData;
    content: HomeContentSettings;
    news: AnyRecord[];
    heroImage: string;
    promoSlides: Array<{ id: string; title: string; description?: string | null; imageUrl: string; linkUrl?: string | null }>;
    featuredStores: AnyRecord[];
    marqueeStores: AnyRecord[];
    smartMallStores: AnyRecord[];
    smartMallProducts: AnyRecord[];
    smartMallOffers: AnyRecord[];
    wings: AnyRecord[];
    visibilityRules: HomeVisibilityRules;
    latestCards: AnyRecord[];
    homeExposures: Record<string, AnyRecord[]>;
  };
}

function MallTrustStrip() {
  const items = [
    { icon: Truck, title: "شحن سريع", text: "تجربة توصيل واضحة لكل متجر" },
    { icon: ShieldCheck, title: "جودة مضمونة", text: "متاجر ومنتجات قابلة للمراجعة" },
    { icon: RotateCcw, title: "إرجاع سهل", text: "طلبات إرجاع ونزاعات موثقة" },
    { icon: Headphones, title: "دعم 24/7", text: "تنبيهات ومتابعة لحظية" }
  ];
  return (
    <section className="mx-auto -mt-8 max-w-7xl px-4 pb-4 md:-mt-10">
      <div className="grid gap-3 rounded-[2rem] border border-white/70 bg-white/90 p-3 shadow-2xl shadow-slate-900/10 backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex items-center gap-3 rounded-2xl bg-slate-50/80 p-4 text-right transition hover:-translate-y-0.5 hover:bg-blue-50">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20"><Icon className="h-5 w-5" /></span>
              <span><b className="block text-sm text-slate-950">{item.title}</b><span className="mt-1 block text-xs font-bold leading-5 text-slate-500">{item.text}</span></span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MobileMarketplaceDock() {
  const items = [
    { href: "/", label: "الرئيسية", icon: Home },
    { href: "/wings", label: "الأجنحة", icon: Layers3 },
    { href: "/offers", label: "العروض", icon: Gift },
    { href: "/cart", label: "السلة", icon: ShoppingCart },
    { href: "/track-order", label: "تتبع", icon: Search }
  ];
  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 rounded-[1.6rem] border border-white/60 bg-slate-950/92 p-2 text-white shadow-2xl backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-black text-white/70 transition hover:bg-white/10 hover:text-white"><Icon className="h-4 w-4" />{item.label}</Link>;
        })}
      </div>
    </nav>
  );
}

function TopNewsBar({ news, label }: { news: AnyRecord[]; label: string }) {
  const text = news.map((item) => item.title).filter(Boolean).join("  •  ") || label;
  return (
    <div className="h-10 border-b border-slate-800 bg-black text-white">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-4 text-xs font-bold md:text-sm">
        <div className="flex shrink-0 items-center gap-2 text-amber-400"><Bell className="h-4 w-4" /> {label}</div>
        <div className="min-w-0 flex-1 overflow-hidden text-slate-200">
          <div className="news-ticker-track inline-flex min-w-[200%] whitespace-nowrap">
            <span className="min-w-1/2 shrink-0">{text}</span>
            <span aria-hidden="true" className="min-w-1/2 shrink-0">{text}</span>
          </div>
        </div>
        <span className="text-slate-500">›</span>
      </div>
    </div>
  );
}

function LuxuryNavbar({ content }: { content: HomeContentSettings }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-xl font-black text-white shadow-lg shadow-orange-500/25">{content.logoLetter}</span>
          <span className="leading-tight">
            <span className="block text-xl font-black tracking-tight md:text-2xl">{content.platformName}</span>
            <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">{content.platformSubtitle}</span>
          </span>
        </Link>
        <div className="hidden max-w-xl flex-1 md:block">
          <SmartSearchBox placeholder={content.searchPlaceholder} />
        </div>
        <nav className="flex items-center gap-2">
          <PublicAuthActions loginLabel={content.loginLabel} openStoreLabel={content.openStoreLabel} />
          <Button variant="secondary" size="icon" className="rounded-xl"><Menu className="h-5 w-5" /></Button>
        </nav>
      </div>
    </header>
  );
}

function HeroSection({ image, content }: { image: string; content: HomeContentSettings }) {
  return (
    <section className="relative min-h-[560px] overflow-hidden bg-slate-950 md:min-h-[620px]">
      <img src={image} alt="المول التجاري الرقمي" className="absolute inset-0 h-full w-full object-cover opacity-95" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/48 via-slate-950/18 to-transparent" />
      <div className="relative mx-auto flex min-h-[560px] max-w-7xl flex-col items-center justify-center px-4 py-16 text-center text-white md:min-h-[620px]">
        <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/25 bg-slate-950/30 px-5 py-3 text-sm font-bold shadow-lg shadow-slate-950/15 backdrop-blur-xl">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-500 text-xs font-black">S</span>
          {content.heroBadge}
        </div>
        <h1 className="max-w-5xl text-5xl font-black leading-tight tracking-tight drop-shadow-[0_4px_16px_rgba(2,6,23,.58)] md:text-7xl lg:text-8xl">{content.heroTitle}</h1>
        <p className="mt-5 max-w-4xl text-base font-semibold leading-8 text-white/90 drop-shadow-[0_2px_10px_rgba(2,6,23,.65)] md:text-xl">{content.heroSubtitle}</p>
      </div>
    </section>
  );
}


function FeaturedStores({ stores, marqueeStores, title = "المتاجر المميزة", content }: { stores: AnyRecord[]; marqueeStores?: AnyRecord[]; title?: string; content: HomeContentSettings }) {
  if (!stores.length && !marqueeStores?.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 text-center" id="featured-stores">
      <SectionKicker label={content.featuredStoresKicker} icon="" />
      <h2 className="mt-3 text-4xl font-black md:text-5xl">{title}</h2>
      <p className="mt-3 text-sm font-semibold text-slate-400 md:text-base">{content.featuredStoresDescription}</p>
      {marqueeStores?.length ? <StoreMarquee stores={marqueeStores as any} /> : null}
      <div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-3">
        {stores.map((store, index) => <FeaturedStoreCard key={store.id || index} store={store} />)}
      </div>
    </section>
  );
}

function FeaturedStoreCard({ store }: { store: AnyRecord }) {
  const image = store.coverImageUrl || store.heroImageUrl || fallbackImages.fashion;
  return (
    <Link href={`/store/${store.slug || "store"}`} className="group overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-2xl">
      <div className="relative h-72 overflow-hidden bg-slate-100">
        <img src={image} alt={store.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
        <div className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-black text-white shadow-lg">{getInitials(store.name).slice(0, 1)}</div>
      </div>
      <div className="p-5">
        <h3 className="text-xl font-black">{store.name}</h3>
        <p className="mt-2 text-sm font-semibold text-slate-400">متجر موثوق داخل المول</p>
      </div>
    </Link>
  );
}

function WingsDiscovery({ wings, title = "استكشف أجنحة المول", content, visibilityRules }: { wings: AnyRecord[]; title?: string; content: HomeContentSettings; visibilityRules: HomeVisibilityRules }) {
  const serializedWings = wings.map((wing) => ({
    id: String(wing.id || ""),
    name: String(wing.name || ""),
    slug: String(wing.slug || ""),
    description: wing.description || null,
    heroImageUrl: wing.heroImageUrl || null,
    desktopImageUrl: wing.desktopImageUrl || null,
    mobileImageUrl: wing.mobileImageUrl || null,
    iconUrl: wing.iconUrl || null,
    storeCount: wing.storeCount ?? null,
    productCount: wing.productCount ?? null,
    ratingAverage: wing.ratingAverage ?? null,
    createdAt: toIsoStringOrNull(wing.createdAt)
  }));

  return (
    <HomeDiscoveryZone
      wings={serializedWings}
      title={title}
      kicker={content.wingsKicker}
      description={content.wingsDescription}
      allButtonLabel={content.wingsAllButton}
      settings={{
        displayCount: visibilityRules.wings.limit,
        rotationIntervalSeconds: visibilityRules.wings.rotationIntervalSeconds,
        marqueeEnabled: visibilityRules.wings.marqueeEnabled,
        newBadgeDays: visibilityRules.wings.newBadgeDays
      }}
    />
  );
}

function WingLuxuryCard({ wing, index }: { wing: AnyRecord; index: number }) {
  const image = wing.heroImageUrl || wing.desktopImageUrl || [fallbackImages.fashion, fallbackImages.electronics, fallbackImages.computers, fallbackImages.perfume][index % 4];
  const color = index % 2 === 0 ? "from-blue-500 to-cyan-500" : "from-purple-500 to-fuchsia-500";
  return (
    <Link href={`/wings/${wing.slug || "wing"}`} className="group overflow-hidden rounded-[2rem] border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-2xl">
      <div className="relative h-64 overflow-hidden bg-slate-100">
        <img src={image} alt={wing.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute right-5 top-5 rounded-full bg-white/30 px-4 py-2 text-sm font-black text-white backdrop-blur">{wing.name}</div>
        <div className={`absolute bottom-5 left-5 rounded-full bg-gradient-to-l ${color} px-4 py-2 text-sm font-black text-white shadow-lg`}>{formatNumber(wing.productCount || wing.orderCount || 1)} منتج</div>
      </div>
      <div className="p-6 text-right">
        <h3 className="text-2xl font-black">{wing.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-500">{wing.description || "مجموعة مختارة من المتاجر والمنتجات داخل هذا الجناح"}</p>
        <div className="mt-5 flex items-center justify-between text-sm font-bold text-slate-500"><span>موثوق ✓</span><span className="flex items-center gap-1 text-amber-500"><Star className="h-4 w-4 fill-current" /> {formatNumber(wing.ratingAverage || 4.5)}</span></div>
      </div>
    </Link>
  );
}

function LatestAdditions({ cards, title = "أحدث الإضافات", content }: { cards: AnyRecord[]; title?: string; content: HomeContentSettings }) {
  if (!cards.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <div className="mb-10 text-right">
        <h2 className="text-4xl font-black md:text-5xl">{title} <span className="text-orange-500">{content.latestHighlight}</span></h2>
        <p className="mt-3 text-sm font-semibold text-slate-400">بطاقات سريعة تقود للمنتج أو الجناح الصحيح بدون أخطاء تنقل.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {cards.map((card, index) => <LatestAdditionCard key={card.id || index} card={card} index={index} />)}
      </div>
    </section>
  );
}

function LatestAdditionCard({ card, index }: { card: AnyRecord; index: number }) {
  const image = card.heroImageUrl || card.mainImageUrl || [fallbackImages.electronics, fallbackImages.fashion, fallbackImages.computers, fallbackImages.perfume][index % 4];
  const href = card.kind === "product" && card.storeSlug ? `/store/${card.storeSlug}/products/${card.slug}` : `/wings/${card.slug || "wing"}`;
  return (
    <Link href={href} prefetch={false} className="group overflow-hidden rounded-[2rem] border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-2xl">
      <div className="relative h-64 overflow-hidden bg-slate-100">
        <img src={image} alt={card.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute right-5 top-5 rounded-full bg-white/30 px-4 py-2 text-sm font-black text-white backdrop-blur">{card.kind === "product" ? "منتج جديد" : "جناح"}</div>
        <div className="absolute bottom-5 left-5 rounded-full bg-gradient-to-l from-amber-500 to-orange-500 px-4 py-2 text-sm font-black text-white shadow-lg">فتح</div>
      </div>
      <div className="p-6 text-right">
        <h3 className="text-2xl font-black">{card.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-500">{card.description || "أحدث الإضافات من المتاجر المعتمدة"}</p>
        <div className="mt-5 flex items-center justify-between text-sm font-bold text-slate-500"><span>{card.storeName || "صلاح سنتر"}</span><span className="flex items-center gap-1 text-amber-500"><Star className="h-4 w-4 fill-current" /> {formatNumber(card.ratingAverage || 0)}</span></div>
      </div>
    </Link>
  );
}


function SeasonalOffersWindow({ title, offers }: { title: string; offers: AnyRecord[] }) {
  const campaigns = [...new Set((offers || []).map((offer) => offer.campaignName).filter(Boolean))];
  return (
    <section className="mx-auto max-w-7xl px-4 py-14" id="offers-link">
      <div className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-l from-slate-950 via-slate-900 to-indigo-950 p-8 text-white shadow-2xl md:p-12">
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-52 w-52 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="text-right">
            <SectionKicker label="OFFERS CENTER" icon="🎁" />
            <h2 className="mt-3 text-4xl font-black md:text-5xl">{title}</h2>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-8 text-white/70 md:text-base">
              لا نعرض عشرات عروض المتاجر في الصفحة الرئيسية. اضغط الزر لاستعراض نافذة العروض المنظمة حسب المناسبات، ثم ادخل للمتجر واشتر المنتج كأي منتج عادي.
            </p>
            {campaigns.length ? <div className="mt-5 flex flex-wrap justify-end gap-2">{campaigns.slice(0, 5).map((campaign) => <span key={campaign} className="rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white/80">{campaign}</span>)}</div> : null}
            {offers.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{offers.slice(0, 3).map((offer) => <Link key={String(offer.id)} href={`/offers/${offer.id}`} className="group rounded-2xl border border-white/15 bg-white/10 p-3 text-right transition hover:bg-white/20"><div className="flex gap-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/10">{offer.imageUrl ? <img src={String(offer.imageUrl)} alt="" className="h-full w-full object-cover"/> : null}</div><div className="min-w-0"><p className="line-clamp-1 font-black text-white">{String(offer.title || "عرض")}</p><p className="mt-1 line-clamp-1 text-xs font-bold text-white/60">{String(offer.storeName || "متجر مشارك")}</p><span className="mt-2 inline-block text-xs font-black text-amber-300">عرض التفاصيل</span></div></div></Link>)}</div> : null}
          </div>
          <Button asChild size="lg" className="h-14 rounded-2xl bg-gradient-to-l from-amber-400 to-orange-500 px-10 text-lg font-black text-slate-950 shadow-xl shadow-amber-500/20">
            <Link href="/offers">دخول صفحة العروض</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function MarketplaceAdsSection({ announcements, title }: { announcements: AnyRecord[]; title: string }) {
  if (!announcements.length) return null;
  // Separate promoted (sponsored) ads from regular ones so each gets its own treatment.
  // Sort promoted by creation date (newest first) so fresh merchant banners aren't pushed out.
  const promoted = announcements
    .filter((a) => a.isPromoted)
    .sort((a, b) => Number(new Date(b.createdAt || 0).getTime() || 0) - Number(new Date(a.createdAt || 0).getTime() || 0));
  const regular = announcements.filter((a) => !a.isPromoted);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8 text-right"><SectionKicker label="MARKETPLACE ADS" icon="📣" /><h2 className="mt-3 text-4xl font-black md:text-5xl">{title}</h2></div>

      {/* Promoted (sponsored) ads — prominent hero-style banners, one per row, full width. */}
      {promoted.length ? (
        <div className="mb-8 space-y-5">
          {promoted.slice(0, 5).map((item) => {
            const card = <article className="group relative min-h-[22rem] overflow-hidden rounded-[2rem] border-2 border-amber-300 bg-slate-950 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl md:min-h-[28rem]">
              {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" loading="lazy" decoding="async" /> : null}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/78 via-slate-950/18 to-transparent" />
              <div className="absolute inset-y-0 right-0 w-2/3 bg-gradient-to-l from-slate-950/55 via-slate-950/20 to-transparent" />
              <span className="absolute right-5 top-5 z-10 inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-white shadow-md">{item.isMerchantAd ? `★ إعلان تاجر مموّل — ${item.storeName}` : "★ إعلان مموّل"}</span>
              <div className="relative flex min-h-[22rem] items-end p-5 text-right md:min-h-[28rem] md:p-9">
                <div className="max-w-2xl rounded-[1.7rem] border border-white/15 bg-slate-950/42 p-5 text-white shadow-2xl backdrop-blur-md md:p-7">
                  <h3 className="text-3xl font-black leading-tight drop-shadow-lg md:text-5xl">{item.title}</h3>
                  <p className="mt-3 text-sm leading-8 text-white/90 md:text-base">{item.summary || item.body || "عرض مميز من إدارة المول"}</p>
                  {item.linkUrl ? <Button asChild size="lg" className="mt-6 w-fit rounded-2xl bg-gradient-to-l from-amber-500 to-orange-500 text-white"><Link href={item.linkUrl}>اكتشف العرض <ArrowLeft className="h-4 w-4" /></Link></Button> : null}
                </div>
              </div>
            </article>;
            return item.isMerchantAd && item.adCampaignId
              ? <MerchantSponsoredBanner key={item.id} item={item as any} />
              : <div key={item.id}>{card}</div>;
          })}
        </div>
      ) : null}

      {/* Regular ads — compact card grid. */}
      {regular.length ? (
        <div className="grid gap-5 md:grid-cols-3">
          {regular.slice(0, 6).map((item) => (
            <article key={item.id} className="overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-2xl">
              {item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="h-44 w-full object-cover" loading="lazy" decoding="async" /> : null}
              <div className="p-5 text-right"><h3 className="text-xl font-black">{item.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-500">{item.summary || item.body || "إعلان عام من إدارة المول"}</p>{item.linkUrl ? <Button asChild variant="outline" className="mt-5 rounded-2xl"><Link href={item.linkUrl}>عرض التفاصيل</Link></Button> : null}</div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function SponsoredProductsShowcase({ products }: { products: AnyRecord[] }) {
  if (!products.length) return null;
  return <section className="mx-auto max-w-7xl px-4 pb-2 pt-12"><div className="mb-8 text-right"><SectionKicker label="SPONSORED PRODUCTS" icon="✦" /><h2 className="mt-3 text-3xl font-black md:text-4xl">منتجات ممولة</h2><p className="mt-2 text-sm font-semibold text-slate-500">إعلانات واضحة ومنفصلة عن الترتيب العضوي. لا تُعرض للمنتج غير المتاح أو المتجر غير النشط.</p></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{products.slice(0, 8).map((product) => <SponsoredAdTracker key={`${product.adCampaignId}:${product.id}`} campaignId={product.adCampaignId} placement={product.adPlacement || "homepage_sponsored_products"} productId={product.id}><Link href={`/store/${product.storeSlug || "store"}/products/${product.slug || product.id}`} className="group block overflow-hidden rounded-3xl border-2 border-amber-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-amber-400 hover:shadow-2xl"><div className="relative h-56 bg-slate-100">{product.mainImageUrl ? <img src={product.mainImageUrl} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" /> : null}<span className="absolute right-3 top-3 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-slate-950 shadow">إعلان ممول</span></div><div className="p-5 text-right"><h3 className="line-clamp-2 min-h-14 text-lg font-black">{product.name}</h3><p className="mt-1 text-xs font-bold text-slate-400">{product.storeName}</p><div className="mt-4 flex items-center justify-between"><span className="font-black text-orange-500">{product.basePrice ? formatCurrency(product.basePrice) : "حسب المتغير"}</span><span className="flex items-center gap-1 text-xs font-bold text-amber-500"><Star className="h-4 w-4 fill-current" /> {formatNumber(product.ratingAverage || 0)}</span></div></div></Link></SponsoredAdTracker>)}</div></section>;
}

function ProductShowcase({ title, products, emptyText, content }: { title: string; products: AnyRecord[]; emptyText: string; content: HomeContentSettings }) {
  if (!products.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8 text-right"><SectionKicker label={content.productsKicker} icon="" /><h2 className="mt-3 text-4xl font-black md:text-5xl">{title}</h2><p className="mt-2 text-sm font-semibold text-slate-400">{emptyText}</p></div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {products.slice(0, 8).map((product) => (
          <Link key={product.id} href={`/store/${product.storeSlug || "store"}/products/${product.slug || product.id}`} className="group overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-2xl">
            <div className="h-56 bg-slate-100">{product.mainImageUrl ? <img src={product.mainImageUrl} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" /> : null}</div>
            <div className="p-5 text-right"><h3 className="line-clamp-2 min-h-14 text-lg font-black">{product.name}</h3><p className="mt-1 text-xs font-bold text-slate-400">{product.storeName}</p><div className="mt-4 flex items-center justify-between"><span className="font-black text-orange-500">{product.basePrice ? formatCurrency(product.basePrice) : "حسب المتغير"}</span><span className="flex items-center gap-1 text-xs font-bold text-amber-500"><Star className="h-4 w-4 fill-current" /> {formatNumber(product.ratingAverage || 0)}</span></div></div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function MerchantCta({ content }: { content: HomeContentSettings }) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14">
      <div className="rounded-[2rem] bg-gradient-to-l from-slate-950 to-slate-800 p-8 text-white shadow-2xl md:flex md:items-center md:justify-between md:p-12">
        <div className="text-right"><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black"><Building2 className="h-4 w-4" /> {content.merchantCtaBadge}</div><h2 className="text-3xl font-black md:text-5xl">{content.merchantCtaTitle}</h2><p className="mt-4 max-w-2xl text-sm leading-8 text-white/70">{content.merchantCtaDescription}</p></div>
        <Button asChild size="lg" className="mt-6 rounded-2xl bg-gradient-to-l from-amber-400 to-orange-500 text-white md:mt-0"><Link href="/apply-store">{content.merchantCtaButton} <ArrowLeft className="h-4 w-4" /></Link></Button>
      </div>
    </section>
  );
}

function CustomHomeSection({ section }: { section: HomeSection }) {
  if (!isCustomHomeSectionType(section.type)) return <section className="mx-auto max-w-7xl px-4 py-10"><div className="rounded-3xl border bg-white p-8 text-right shadow-sm"><h2 className="text-3xl font-black">{section.title}</h2><p className="mt-3 text-sm leading-7 text-slate-500">قسم مخصص محفوظ في الواجهة. اختر قالباً مدعوماً من لوحة الإعدادات لعرض محتوى غني.</p></div></section>;
  const config = normalizeCustomHomeSectionConfig(section.config);
  const style = { backgroundColor: config.backgroundColor, color: config.textColor };
  if (section.type === "custom_banner") return <section className="mx-auto max-w-7xl px-4 py-8"><div className="relative overflow-hidden rounded-[2rem] p-8 shadow-card" style={style}>{config.imageUrl ? <img src={config.imageUrl} alt={section.title} className="absolute inset-0 h-full w-full object-cover opacity-25" loading="lazy" decoding="async" /> : null}<div className="relative max-w-3xl text-right">{config.eyebrow ? <p className="text-sm font-black opacity-75">{config.eyebrow}</p> : null}<h2 className="mt-2 text-3xl font-black md:text-5xl">{section.title}</h2>{config.text ? <p className="mt-4 text-sm leading-8 opacity-90 md:text-base">{config.text}</p> : null}{config.ctaLabel && config.ctaUrl ? <Button asChild className="mt-6"><Link href={config.ctaUrl}>{config.ctaLabel}<ArrowLeft className="h-4 w-4"/></Link></Button> : null}</div></div></section>;
  if (section.type === "custom_cta") return <section className="mx-auto max-w-7xl px-4 py-10"><div className="rounded-[2rem] p-8 text-center shadow-card" style={style}>{config.eyebrow ? <p className="text-sm font-black opacity-75">{config.eyebrow}</p> : null}<h2 className="mt-2 text-3xl font-black">{section.title}</h2>{config.text ? <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 opacity-90">{config.text}</p> : null}{config.ctaLabel && config.ctaUrl ? <Button asChild className="mt-6"><Link href={config.ctaUrl}>{config.ctaLabel}<ArrowLeft className="h-4 w-4"/></Link></Button> : null}</div></section>;
  if (section.type === "custom_link_grid") return <section className="mx-auto max-w-7xl px-4 py-10"><div className="rounded-3xl border bg-white p-6 shadow-card"><div className="text-right"><p className="text-sm font-black text-primary">{config.eyebrow || "روابط سريعة"}</p><h2 className="mt-2 text-3xl font-black">{section.title}</h2>{config.text ? <p className="mt-2 text-sm leading-7 text-slate-500">{config.text}</p> : null}</div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{config.links.map((link) => <Link key={`${link.label}-${link.url}`} href={link.url} className="rounded-2xl border bg-slate-50 p-4 text-right font-black text-slate-800 transition hover:border-primary hover:bg-blue-50 hover:text-primary">{link.label}<ArrowLeft className="float-left h-4 w-4"/></Link>)}</div></div></section>;
  return <section className="mx-auto max-w-4xl px-4 py-10"><div className="rounded-3xl border bg-white p-8 text-right shadow-card" style={{ borderColor: config.backgroundColor }}><p className="text-sm font-black" style={{ color: config.backgroundColor }}>{config.eyebrow || "محتوى"}</p><h2 className="mt-2 text-3xl font-black">{section.title}</h2><p className="mt-4 whitespace-pre-line text-sm leading-8 text-slate-600">{config.text || "اكتب محتوى القسم من لوحة الإدارة."}</p>{config.ctaLabel && config.ctaUrl ? <Button asChild variant="outline" className="mt-6"><Link href={config.ctaUrl}>{config.ctaLabel}<ArrowLeft className="h-4 w-4"/></Link></Button> : null}</div></section>;
}

function toIsoStringOrNull(value: unknown) {
  if (!value) return null;
  const date = new Date(value as string | Date);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function SectionKicker({ label, icon }: { label: string; icon: string }) {
  return <div className="text-sm font-black uppercase tracking-wide text-amber-500">{label} {icon}</div>;
}

function HomeFooter({ content }: { content: HomeContentSettings }) {
  return <footer className="border-t bg-slate-950 py-10 text-center text-sm font-bold text-slate-300"><div>{content.footerText}</div><div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-slate-400">{content.contactPhone ? <span>{content.contactPhone}</span> : null}{content.contactEmail ? <span>{content.contactEmail}</span> : null}{content.whatsappUrl ? <a href={content.whatsappUrl}>واتساب</a> : null}{content.facebookUrl ? <a href={content.facebookUrl}>فيسبوك</a> : null}{content.instagramUrl ? <a href={content.instagramUrl}>إنستغرام</a> : null}</div></footer>;
}

function buildPromoSlides(items: AnyRecord[] = [], fallback?: AnyRecord) {
  const fallbackSlides: AnyRecord[] = [
    { id: "fallback-promo-1", title: "تجربة تسوق رقمية متجددة", description: "اكتشف المتاجر والأجنحة والعروض المختارة داخل صلاح سنتر", imageUrl: fallbackImages.gift, linkUrl: "/wings" },
    { id: "fallback-promo-2", title: "متاجر مميزة تتغير باستمرار", description: "تابع أحدث المحلات والمنتجات التي يضيفها التجار", imageUrl: fallbackImages.mall, linkUrl: "#featured-stores" },
    { id: "fallback-promo-3", title: "نافذة عروض منظمة حسب المناسبات", description: "ادخل صفحة العروض ثم انتقل للمتجر واشتر المنتج مباشرة", imageUrl: fallbackImages.electronics, linkUrl: "/offers" }
  ];
  const source = items.length ? items : fallback ? [fallback, ...fallbackSlides] : fallbackSlides;
  const animatedSource = source.length > 1 ? source : [...source, ...fallbackSlides.filter((slide) => slide.id !== source[0]?.id)];
  const slides = animatedSource
    .filter(Boolean)
    .map((item, index) => ({
      id: String(item.id || `promo-${index}`),
      title: item.title || "تخفيضات الصيف - خصومات تصل إلى 50%",
      description: item.description || item.summary || item.body || "اكتشف عروض إدارة المول المختارة بعناية",
      imageUrl: item.imageUrl || fallbackImages.gift,
      linkUrl: item.linkUrl || "#"
    }));
  return slides.length ? slides : [{ id: "fallback-promo", title: "تخفيضات الصيف - خصومات تصل إلى 50%", description: "عروض مميزة من إدارة المول", imageUrl: fallbackImages.gift, linkUrl: "#" }];
}

function uniqueRecordsById(items: AnyRecord[]) {
  const seen = new Set<string>();
  return items.filter((item, index) => {
    const key = String(item.id || item.slug || `item-${index}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildLatestCards(data: LuxuryHomeData, wings: AnyRecord[]) {
  return buildLatestHomeCards(data, wings, [fallbackImages.electronics, fallbackImages.fashion, fallbackImages.computers]);
}
