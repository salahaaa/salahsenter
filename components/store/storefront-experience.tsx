"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgePercent,
  Bell,
  ChevronLeft,
  ChevronRight,
  Eye,
  Grid3X3,
  Home,
  MessageCircle,
  PackageOpen,
  Phone,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Truck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrencyPrice, CurrencySelector, CurrencySync } from "@/components/currency/currency-price";
import { ProductMediaFrame } from "@/components/product/product-media-frame";
import type { StoreCurrencySettings } from "@/lib/currency-shared";
import { formatNumber, getInitials } from "@/lib/utils";

type StorefrontStore = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  coverImageUrl?: string | null;
  contactPhone?: string | null;
  whatsappUrl?: string | null;
  storeCommerceType?: string | null;
  operationStatus?: string | null;
  operationNote?: string | null;
  businessHours?: Record<string, unknown> | null;
  ratingAverage?: string | number | null;
  orderCount?: number | null;
};

type StorefrontMedia = { id?: string; mediaType?: string; url?: string | null; alt?: string | null; sortOrder?: number | null };
type StorefrontNews = { id: string; title: string; body?: string | null; linkUrl?: string | null; isPinned?: boolean | null };
type StorefrontAnnouncement = { id: string; title: string; summary?: string | null; body?: string | null; imageUrl?: string | null; linkUrl?: string | null; isPinned?: boolean | null; isPromoted?: boolean | null };
type StorefrontOffer = { id: string; title: string; description?: string | null; imageUrl?: string | null; isPromoted?: boolean | null; offerProductSlug?: string | null; startsAt?: Date | string | null; endsAt?: Date | string | null };
type StorefrontCategory = { id: string; name: string; slug: string; imageUrl?: string | null; previewImageUrl?: string | null; productCount?: number };
type StorefrontProduct = {
  id: string;
  name: string;
  slug: string;
  categoryId?: string | null;
  mainImageUrl?: string | null;
  basePrice?: string | number | null;
  ratingAverage?: string | number | null;
  soldCount?: number | null;
  viewCount?: number | null;
  defaultVariantId?: string | null;
  defaultVariantStock?: number | null;
  status?: string;
  productCommerceType?: string | null;
  showcaseStatus?: string | null;
  showcaseSoldAt?: string | Date | null;
  showcaseNote?: string | null;
};

type CartItem = {
  id: string;
  productId: string;
  variantId: string | null;
  storeId: string;
  storeSlug: string;
  name: string;
  href: string;
  imageUrl?: string | null;
  price?: string | number | null;
  storeName: string;
  quantity: number;
  addedAt: string;
};

type Slide = { id: string; title: string; subtitle?: string | null; imageUrl: string; href?: string | null; badge?: string };


const StoreCartDrawer = dynamic(() => import("@/components/store/store-cart-drawer").then((module) => module.StoreCartDrawer), { loading: () => null });
const cartKey = "salah_center_cart";

function createOrderIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `order_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function StorefrontExperience({
  store,
  gallery,
  announcements,
  news,
  categories,
  products,
  offers = [],
  currencySettings,
  isPreview = false
}: {
  store: StorefrontStore;
  gallery: StorefrontMedia[];
  announcements: StorefrontAnnouncement[];
  news: StorefrontNews[];
  categories: StorefrontCategory[];
  products: StorefrontProduct[];
  offers?: StorefrontOffer[];
  currencySettings: StoreCurrencySettings;
  isPreview?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    try {
      const rows = JSON.parse(localStorage.getItem(cartKey) || "[]") as CartItem[];
      setCart(Array.isArray(rows) ? rows : []);
    } catch {
      setCart([]);
    }
  }, []);

  function showNotice(value: string) {
    setNotice(value);
    window.setTimeout(() => setNotice(null), 3500);
  }

  function saveCart(next: CartItem[]) {
    setCart(next);
    localStorage.setItem(cartKey, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("salah-center-cart-updated"));
  }

  const categoriesWithCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const previewByCategory = new Map<string, string | null>();
    for (const product of products) {
      if (!product.categoryId) continue;
      counts.set(product.categoryId, (counts.get(product.categoryId) || 0) + 1);
      if (!previewByCategory.has(product.categoryId) && product.mainImageUrl) previewByCategory.set(product.categoryId, product.mainImageUrl);
    }
    return categories.map((category) => ({
      ...category,
      productCount: counts.get(category.id) || category.productCount || 0,
      previewImageUrl: category.imageUrl || previewByCategory.get(category.id) || null
    }));
  }, [categories, products]);

  const newestProducts = products.slice(0, 12);
  const popularProducts = [...products].sort((a, b) => Number(b.soldCount || 0) - Number(a.soldCount || 0)).slice(0, 10);
  const mostViewedProducts = [...products].sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0)).slice(0, 10);
  const grouped = categoriesWithCounts
    .map((category) => ({ category, products: products.filter((product) => product.categoryId === category.id).slice(0, 8) }))
    .filter((group) => group.products.length)
    .slice(0, 5);

  const trimmedQuery = query.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const matchesCategory = !activeCategory || product.categoryId === activeCategory;
    const matchesQuery = !trimmedQuery || product.name.toLowerCase().includes(trimmedQuery);
    return matchesCategory && matchesQuery;
  });

  const isStoreOpen = !store.operationStatus || store.operationStatus === "OPEN";
  const storeCart = cart.filter((item) => item.storeId === store.id || item.storeSlug === store.slug);
  const cartCount = storeCart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = storeCart.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);

  function productHref(product: StorefrontProduct) {
    return `/store/${store.slug}/products/${product.slug}${isPreview ? "?preview=1" : ""}`;
  }

  function addToCart(product: StorefrontProduct, quantity = 1, open = false) {
    if (!isStoreOpen) {
      showNotice(store.operationStatus === "VACATION" ? "المحل في إجازة حالياً." : store.operationStatus === "PAUSED" ? "المحل متوقف مؤقتاً." : "المحل مغلق حالياً.");
      return;
    }
    if (product.productCommerceType === "SHOWCASE_ONLY" || product.showcaseStatus === "SOLD") {
      showNotice(product.showcaseStatus === "SOLD" ? "تم بيع هذا المنتج بالفعل." : "هذا الصنف للعرض فقط. تواصل مع المتجر للشراء.");
      return;
    }
    if (!product.defaultVariantId) {
      showNotice("هذا المنتج يحتاج فتح التفاصيل لاختيار المتغير المناسب.");
      return;
    }
    const item: CartItem = {
      id: `${product.id}:${product.defaultVariantId}`,
      productId: product.id,
      variantId: product.defaultVariantId,
      storeId: store.id,
      storeSlug: store.slug,
      name: product.name,
      href: productHref(product),
      imageUrl: product.mainImageUrl,
      price: product.basePrice,
      storeName: store.name,
      quantity,
      addedAt: new Date().toISOString()
    };
    const exists = cart.find((row) => row.id === item.id);
    const next = exists ? cart.map((row) => row.id === item.id ? { ...row, quantity: row.quantity + quantity, addedAt: item.addedAt } : row) : [item, ...cart];
    saveCart(next);
    if (open) setCartOpen(true);
    showNotice("✓ تم إضافة المنتج إلى سلة المتجر");
  }

  function updateQuantity(id: string, quantity: number) {
    const next = cart.map((item) => item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item);
    saveCart(next);
  }

  function removeFromCart(id: string) {
    saveCart(cart.filter((item) => item.id !== id));
  }


  function buyNow(product: StorefrontProduct) {
    if (!isStoreOpen) return showNotice("المحل غير مفتوح حالياً ولا يستقبل طلبات إلكترونية.");
    if (product.productCommerceType === "SHOWCASE_ONLY" || product.showcaseStatus === "SOLD") {
      window.location.href = productHref(product);
      return;
    }
    if (!product.defaultVariantId) {
      window.location.href = productHref(product);
      return;
    }
    addToCart(product, 1, false);
    window.location.href = "/checkout";
  }

  function openWhatsapp() {
    const text = encodeURIComponent(`مرحباً، أريد الاستفسار عن متجر ${store.name}`);
    const url = store.whatsappUrl || (store.contactPhone ? `https://wa.me/${store.contactPhone.replace(/[^0-9]/g, "")}` : "https://api.whatsapp.com/send");
    const separator = url.includes("?") ? "&" : "?";
    window.open(`${url}${separator}text=${text}`, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="container space-y-8 pb-28 md:pb-8">
      <StoreNewsRibbon news={news} announcements={announcements} storeName={store.name} />
      <StoreAdBoard store={store} gallery={gallery} announcements={announcements} />
      <StoreFeatureStrip />
      <StoreOperationBanner store={store} />

      <StoreSearchAndFilters query={query} setQuery={setQuery} activeCategory={activeCategory} setActiveCategory={setActiveCategory} categories={categoriesWithCounts} />
      <StoreCategoryMarquee storeSlug={store.slug} categories={categoriesWithCounts} onPick={setActiveCategory} />
      <SmartCategoryRecommendations categories={categoriesWithCounts} products={products} onPick={setActiveCategory} />
      <StoreOffersSection offers={offers} storeSlug={store.slug} />
      <div className="flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-[1.7rem] border border-teal-100 bg-gradient-to-l from-teal-50 via-white to-cyan-50 p-4 shadow-card">
        <div className="text-right">
          <p className="text-xs font-black uppercase tracking-wide text-teal-700">STORE CATALOG</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">تسوق منتجات {store.name}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">صور كاملة بلا قص، بطاقات موبايل سريعة، بحث وفلاتر وسلة شراء مباشرة.</p>
        </div>
        <div className="flex items-center gap-2"><CurrencySelector settings={currencySettings} /><CurrencySync settings={currencySettings} /></div>
      </div>
      {(query || activeCategory) ? (
        <ProductGrid title="نتائج البحث والفلترة" products={filteredProducts} storeSlug={store.slug} currencySettings={currencySettings} isPreview={isPreview} onAdd={addToCart} onBuy={buyNow} />
      ) : null}
      <ProductRail title="أحدث المنتجات" subtitle="آخر ما أضافه المتجر" products={newestProducts} storeSlug={store.slug} currencySettings={currencySettings} isPreview={isPreview} onAdd={addToCart} onBuy={buyNow} />
      {popularProducts.length ? <ProductRail title="الأكثر طلباً" subtitle="مرتبة حسب المبيعات داخل المتجر" products={popularProducts} storeSlug={store.slug} currencySettings={currencySettings} isPreview={isPreview} onAdd={addToCart} onBuy={buyNow} tone="amber" /> : null}
      {mostViewedProducts.length ? <ProductRail title="الأكثر مشاهدة" subtitle="منتجات يتفاعل معها الزوار" products={mostViewedProducts} storeSlug={store.slug} currencySettings={currencySettings} isPreview={isPreview} onAdd={addToCart} onBuy={buyNow} tone="emerald" /> : null}
      {grouped.map((group) => <CategoryProductBlock key={group.category.id} group={group} storeSlug={store.slug} currencySettings={currencySettings} isPreview={isPreview} onAdd={addToCart} onBuy={buyNow} />)}
      {!products.length ? <EmptyStoreCatalog /> : null}
      {notice ? <div className="fixed bottom-24 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-2xl border bg-white p-4 text-center text-sm font-black text-slate-800 shadow-2xl md:bottom-8">{notice}</div> : null}
      <StoreCartDrawer open={cartOpen} onClose={() => setCartOpen(false)} items={storeCart} total={cartTotal} currencySettings={currencySettings} checkoutLoading={false} onUpdate={updateQuantity} onRemove={removeFromCart} />
      <StoreBottomNavigation cartCount={cartCount} onCart={() => setCartOpen(true)} onWhatsapp={openWhatsapp} />
    </section>
  );
}

function StoreNewsRibbon({ news, announcements, storeName }: { news: StorefrontNews[]; announcements: StorefrontAnnouncement[]; storeName: string }) {
  const items = [...news.map((item) => item.title), ...announcements.filter((item) => item.isPinned || item.isPromoted).map((item) => item.title)].filter(Boolean);
  const text = items.length ? items.join("  •  ") : `تابع أحدث أخبار وعروض ${storeName} من هنا`;
  return (
    <div className="overflow-hidden rounded-[1.5rem] border bg-slate-950 text-white shadow-card">
      <div className="flex min-h-14 items-center gap-4 px-4 py-3">
        <span className="flex shrink-0 items-center gap-2 rounded-2xl bg-amber-400 px-4 py-2 text-xs font-black text-slate-950"><Bell className="h-4 w-4" /> أخبار المتجر</span>
        <div className="min-w-0 flex-1 overflow-hidden text-sm font-black text-white/85">
          <div className="news-ticker-track inline-flex min-w-max gap-12 whitespace-nowrap">
            <span>{text}</span><span aria-hidden="true">{text}</span><span aria-hidden="true">{text}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StoreAdBoard({ store, gallery, announcements }: { store: StorefrontStore; gallery: StorefrontMedia[]; announcements: StorefrontAnnouncement[] }) {
  const slides = useMemo(() => buildSlides(store, gallery, announcements), [store, gallery, announcements]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % slides.length), 4800);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const current = slides[active] || slides[0];
  if (!current) return null;
  return (
    <section className="overflow-hidden rounded-[2.2rem] border bg-white shadow-card" id="store-ad-board">
      <div className="relative min-h-[330px] overflow-hidden bg-slate-950 text-white md:min-h-[420px]">
        <img src={current.imageUrl} alt={current.title} className="absolute inset-0 h-full w-full object-cover opacity-100" loading="eager" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/78 via-slate-950/20 to-transparent" />
        <div className="relative grid min-h-[330px] gap-5 p-6 md:min-h-[420px] md:grid-cols-[1fr_auto] md:items-end md:p-10">
          <div className="max-w-2xl text-right">
            <Badge className="mb-4 bg-white/15 text-white backdrop-blur"><BadgePercent className="ml-1 h-4 w-4 text-amber-300" /> {current.badge || "لوحة إعلانية"}</Badge>
            <h2 className="text-4xl font-black leading-tight md:text-6xl">{current.title}</h2>
            <p className="mt-4 max-w-xl text-sm font-semibold leading-8 text-white/75 md:text-base">{current.subtitle || store.description || "اكتشف العروض والمجموعات المختارة داخل المتجر."}</p>
            <div className="mt-7 flex flex-wrap justify-end gap-3">
              <Button asChild size="lg" className="rounded-2xl bg-gradient-to-l from-amber-400 to-orange-500 px-8 text-slate-950 hover:from-amber-300 hover:to-orange-400"><Link href={current.href || "#store-products"}>تسوق الآن <ArrowLeft className="h-4 w-4" /></Link></Button>
              <Button asChild size="lg" variant="outline" className="rounded-2xl border-white/25 bg-white/10 px-8 text-white hover:bg-white/20"><Link href="#store-categories">المجموعات</Link></Button>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 self-end">
            <button type="button" onClick={() => setActive((index) => (index - 1 + slides.length) % slides.length)} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20" aria-label="السابق"><ChevronRight className="h-5 w-5" /></button>
            <button type="button" onClick={() => setActive((index) => (index + 1) % slides.length)} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20" aria-label="التالي"><ChevronLeft className="h-5 w-5" /></button>
          </div>
        </div>
        {slides.length > 1 ? <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">{slides.map((slide, index) => <button key={slide.id} onClick={() => setActive(index)} className={`h-2 rounded-full transition-all ${index === active ? "w-8 bg-amber-400" : "w-2 bg-white/40"}`} aria-label={`إعلان ${index + 1}`} />)}</div> : null}
      </div>
    </section>
  );
}

function ShowcaseContactPanel({ store, onWhatsapp }: { store: StorefrontStore; onWhatsapp: () => void }) {
  return (
    <section className="rounded-[2rem] border border-amber-200 bg-gradient-to-l from-amber-50 to-orange-50 p-6 text-right shadow-card">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Badge className="mb-3 bg-amber-500 text-white">متجر عرض فقط</Badge>
          <h2 className="text-2xl font-black text-slate-950">هذا المتجر يعرض منتجاته للتواصل والزيارة</h2>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-600">يمكنك مشاهدة المنتجات والأسعار التقريبية والتفاصيل، ثم التواصل مع المتجر أو زيارة المعرض لإتمام الشراء.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onWhatsapp} className="rounded-2xl bg-emerald-600 hover:bg-emerald-700"><MessageCircle className="h-4 w-4" /> تواصل واتساب</Button>
          {store.contactPhone ? <Button asChild variant="outline" className="rounded-2xl bg-white"><a href={`tel:${store.contactPhone}`}><Phone className="h-4 w-4" /> اتصال</a></Button> : null}
          <Button asChild variant="outline" className="rounded-2xl bg-white"><a href="#store-search">استعراض المنتجات</a></Button>
        </div>
      </div>
    </section>
  );
}

function StoreOperationBanner({ store }: { store: StorefrontStore }) {
  const status = store.operationStatus || "OPEN";
  const labels: Record<string, { title: string; tone: string; text: string }> = {
    OPEN: { title: "مفتوح الآن", tone: "border-emerald-200 bg-emerald-50 text-emerald-800", text: "المتجر يستقبل الطلبات والتواصل حالياً." },
    CLOSED: { title: "مغلق حالياً", tone: "border-slate-200 bg-slate-50 text-slate-700", text: "يمكنك التصفح الآن والعودة لاحقاً عند فتح المحل." },
    VACATION: { title: "في إجازة", tone: "border-amber-200 bg-amber-50 text-amber-800", text: "المتجر في إجازة مؤقتة وقد يتأخر الرد أو الطلب." },
    PAUSED: { title: "متوقف مؤقتاً", tone: "border-red-200 bg-red-50 text-red-800", text: "المتجر متوقف مؤقتاً ولا يستقبل طلبات حالياً." }
  };
  const item = labels[status] || labels.OPEN;
  return (
    <section className={`rounded-[2rem] border p-5 text-right shadow-card ${item.tone}`}>
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div><h2 className="text-xl font-black">{item.title}</h2><p className="mt-1 text-sm font-bold leading-7">{store.operationNote || item.text}</p></div>
        {store.businessHours && Object.keys(store.businessHours).length ? <pre className="max-h-28 overflow-auto rounded-2xl bg-white/70 p-3 text-left text-xs direction-ltr">{JSON.stringify(store.businessHours, null, 2)}</pre> : null}
      </div>
    </section>
  );
}

function StoreFeatureStrip() {
  const features = [
    { icon: <Truck className="h-5 w-5" />, title: "توصيل سريع", text: "تجربة شراء مريحة مثل التطبيقات" },
    { icon: <ShieldCheck className="h-5 w-5" />, title: "جودة مضمونة", text: "تنظيم واضح للمنتجات والمجموعات" },
    { icon: <Search className="h-5 w-5" />, title: "بحث وفلاتر", text: "الوصول لأي منتج خلال ثوانٍ" },
    { icon: <ShoppingCart className="h-5 w-5" />, title: "سلة متجر", text: "شراء وتجميع منتجات المتجر" }
  ];
  return <div className="grid gap-4 md:grid-cols-4">{features.map((item) => <div key={item.title} className="rounded-3xl border bg-white p-5 text-right shadow-card"><div className="mb-3 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-600">{item.icon}</div><h3 className="font-black text-slate-950">{item.title}</h3><p className="mt-1 text-xs font-semibold leading-6 text-slate-500">{item.text}</p></div>)}</div>;
}

function StoreSearchAndFilters({ query, setQuery, activeCategory, setActiveCategory, categories }: { query: string; setQuery: (value: string) => void; activeCategory: string | null; setActiveCategory: (id: string | null) => void; categories: StorefrontCategory[] }) {
  return (
    <section id="store-search" className="rounded-[2rem] border bg-white p-5 shadow-card">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث داخل هذا المتجر فقط..." className="h-14 w-full rounded-2xl border bg-slate-50 pr-12 pl-4 text-right text-sm font-bold outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100" />
        </div>
        <Button type="button" variant="outline" className="rounded-2xl" onClick={() => { setQuery(""); setActiveCategory(null); }}>إلغاء الفلاتر</Button>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2" id="store-filter-categories">
        <button type="button" onClick={() => setActiveCategory(null)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black transition ${!activeCategory ? "border-blue-200 bg-blue-50 text-blue-700" : "bg-white text-slate-600 hover:bg-slate-50"}`}>كل المنتجات</button>
        {categories.map((category) => <button key={category.id} type="button" onClick={() => setActiveCategory(category.id)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-black transition ${activeCategory === category.id ? "border-blue-200 bg-blue-50 text-blue-700" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{category.name} <span className="text-xs text-slate-400">{formatNumber(category.productCount || 0)}</span></button>)}
      </div>
    </section>
  );
}

function StoreCategoryMarquee({ storeSlug, categories, onPick }: { storeSlug: string; categories: StorefrontCategory[]; onPick: (id: string | null) => void }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0 });
  if (!categories.length) return null;
  const items = categories.length > 5 ? [...categories, ...categories] : categories;
  return (
    <section id="store-categories" className="overflow-hidden rounded-[2rem] border bg-slate-950 p-4 text-white shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1 text-right">
        <div><p className="text-xs font-black uppercase text-amber-300">GROUP SHORTCUTS</p><h2 className="mt-1 text-2xl font-black">اختصارات مجموعات المتجر</h2></div>
        <p className="text-xs font-bold text-white/60">صور كاملة وواضحة — اسحب الشريط أو اضغط لتصفية المنتجات</p>
      </div>
      <div
        ref={scrollerRef}
        className="store-marquee-scroll overflow-x-auto rounded-2xl pb-1"
        onPointerDown={(event) => { const node = scrollerRef.current; if (!node) return; drag.current = { active: true, startX: event.clientX, scrollLeft: node.scrollLeft }; node.setPointerCapture?.(event.pointerId); }}
        onPointerMove={(event) => { const node = scrollerRef.current; if (!node || !drag.current.active) return; node.scrollLeft = drag.current.scrollLeft - (event.clientX - drag.current.startX); }}
        onPointerUp={(event) => { scrollerRef.current?.releasePointerCapture?.(event.pointerId); drag.current.active = false; }}
        onPointerCancel={() => { drag.current.active = false; }}
      >
        <div className="store-marquee-track flex w-max gap-3 px-1">
          <AllCategoriesChip onPick={() => onPick(null)} />
          {items.map((category, index) => <CategoryChip key={`${category.id}-${index}`} storeSlug={storeSlug} category={category} onPick={onPick} />)}
        </div>
      </div>
    </section>
  );
}

function AllCategoriesChip({ onPick }: { onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className="group relative min-h-[190px] w-[240px] shrink-0 overflow-hidden rounded-[1.6rem] border border-amber-200 bg-gradient-to-br from-amber-400 to-orange-500 text-right text-slate-950 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl">
      <div className="flex h-full flex-col justify-center p-5">
        <Grid3X3 className="mb-4 h-10 w-10 rounded-2xl bg-white/80 p-2 text-orange-600" />
        <h3 className="text-2xl font-black">كل المنتجات</h3>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-800">اعرض كل أصناف المتجر بدون انتظار الشريط.</p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-black">فتح الكل <ArrowLeft className="h-4 w-4" /></span>
      </div>
    </button>
  );
}

function CategoryChip({ category, onPick }: { storeSlug: string; category: StorefrontCategory; onPick: (id: string | null) => void }) {
  const image = category.previewImageUrl || category.imageUrl;
  return (
    <button type="button" onClick={() => onPick(category.id)} className="group relative min-h-[190px] w-[260px] shrink-0 overflow-hidden rounded-[1.6rem] border border-white/10 bg-white text-right text-slate-950 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-blue-50" />
      <div className="relative h-32 bg-white p-2">
        {image ? <img src={image} alt={category.name} className="h-full w-full object-contain transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" /> : <div className="grid h-full place-items-center rounded-2xl bg-slate-100 text-3xl font-black text-slate-400">{getInitials(category.name).slice(0, 1)}</div>}
      </div>
      <div className="relative p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="line-clamp-1 font-black">{category.name}</p>
          <ArrowLeft className="h-4 w-4 shrink-0 text-blue-600" />
        </div>
        <p className="mt-1 text-xs font-bold text-slate-500">{formatNumber(category.productCount || 0)} منتج داخل المجموعة</p>
      </div>
    </button>
  );
}

function SmartCategoryRecommendations({ categories, products, onPick }: { categories: StorefrontCategory[]; products: StorefrontProduct[]; onPick: (id: string) => void }) {
  const suggestions = useMemo(() => {
    return categories
      .map((category) => {
        const categoryProducts = products.filter((product) => product.categoryId === category.id);
        const score = categoryProducts.length * 8 + categoryProducts.reduce((sum, product) => sum + Number(product.soldCount || 0) * 2 + Number(product.viewCount || 0) * 0.3 + Number(product.ratingAverage || 0), 0);
        const averagePrice = categoryProducts.length ? categoryProducts.reduce((sum, product) => sum + Number(product.basePrice || 0), 0) / categoryProducts.length : 0;
        const reason = categoryProducts.some((product) => Number(product.soldCount || 0) > 0) ? "الأكثر طلباً داخل المتجر" : categoryProducts.length ? "مجموعة نشطة ومناسبة للتصفح" : "قسم مقترح";
        return { category, score, averagePrice, reason, count: categoryProducts.length };
      })
      .filter((item) => item.count > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [categories, products]);
  if (!suggestions.length) return null;
  return (
    <section className="rounded-[2rem] border bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-right">
        <div><p className="text-xs font-black uppercase text-emerald-600">AI CATEGORY PICKS</p><h2 className="mt-1 text-2xl font-black text-slate-950">أقسام مقترحة لك</h2><p className="mt-1 text-sm font-semibold text-slate-500">اقتراحات ذكية بناءً على نشاط المنتجات، المبيعات والمشاهدات داخل هذا المتجر.</p></div>
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {suggestions.map(({ category, reason, count, averagePrice }) => { const image = category.previewImageUrl || category.imageUrl; return <button key={category.id} type="button" onClick={() => onPick(category.id)} className="group overflow-hidden rounded-3xl border bg-slate-50 text-right transition hover:-translate-y-1 hover:border-emerald-200 hover:bg-emerald-50 hover:shadow-soft"><div className="grid h-32 place-items-center bg-white p-2 font-black text-emerald-600">{image ? <img src={image} alt={category.name} className="h-full w-full object-contain transition duration-500 group-hover:scale-105" loading="lazy" /> : getInitials(category.name).slice(0, 1)}</div><div className="p-4"><h3 className="line-clamp-1 font-black text-slate-950">{category.name}</h3><p className="mt-1 text-xs font-bold text-slate-500">{reason}</p><p className="mt-2 text-[11px] font-black text-emerald-700">{formatNumber(count)} منتج{averagePrice ? ` • متوسط ${formatNumber(Math.round(averagePrice))}` : ""}</p></div></button>; })}
      </div>
    </section>
  );
}

function StoreOffersSection({ offers, storeSlug }: { offers: StorefrontOffer[]; storeSlug: string }) {
  if (!offers.length) return null;
  return (
    <section id="store-offers" className="rounded-[2rem] border bg-white p-5 shadow-card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-right">
        <div><p className="text-xs font-black uppercase text-orange-500">OFFERS</p><h2 className="mt-1 text-2xl font-black text-slate-950">عروض المتجر</h2><p className="mt-1 text-sm font-semibold text-slate-500">مساحة ربحية مخصصة للعروض والحملات داخل المتجر.</p></div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-3">
        {offers.map((offer) => <Link key={offer.id} href={offer.offerProductSlug ? `/store/${storeSlug}/products/${offer.offerProductSlug}` : `/store/${storeSlug}?offer=${offer.id}`} className="group min-w-[280px] overflow-hidden rounded-3xl border bg-slate-50 shadow-sm transition hover:-translate-y-1 hover:shadow-soft"><div className="relative h-40 bg-gradient-to-l from-orange-500 to-amber-400">{offer.imageUrl ? <img src={offer.imageUrl} alt={offer.title} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : null}<div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" /><Badge className="absolute right-3 top-3 bg-white/90 text-slate-800">{offer.isPromoted ? "مروج" : "عرض"}</Badge><h3 className="absolute bottom-4 right-4 left-4 line-clamp-2 text-right text-xl font-black text-white">{offer.title}</h3></div><div className="p-4 text-right"><p className="line-clamp-2 text-sm leading-6 text-slate-500">{offer.description || "افتح العرض وشاهد المنتجات المشمولة."}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-black text-orange-600">فتح العرض <ArrowLeft className="h-4 w-4" /></span></div></Link>)}
      </div>
    </section>
  );
}

function ProductRail({ title, subtitle, products, storeSlug, currencySettings, isPreview, onAdd, onBuy, showcaseOnly, tone = "blue" }: { title: string; subtitle: string; products: StorefrontProduct[]; storeSlug: string; currencySettings: StoreCurrencySettings; isPreview: boolean; onAdd: (product: StorefrontProduct, quantity?: number, open?: boolean) => void; onBuy: (product: StorefrontProduct) => void; showcaseOnly?: boolean; tone?: "blue" | "amber" | "emerald" }) {
  if (!products.length) return null;
  const toneClass = tone === "amber" ? "text-amber-500" : tone === "emerald" ? "text-emerald-600" : "text-blue-600";
  return (
    <section id="store-products" className="rounded-[2rem] border bg-white p-5 shadow-card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-right">
        <div><p className={`text-xs font-black uppercase ${toneClass}`}>{subtitle}</p><h2 className="mt-1 text-2xl font-black text-slate-950 md:text-3xl">{title}</h2></div>
        <Button asChild variant="outline" className="rounded-2xl"><Link href="#store-filter-categories">فلترة حسب المجموعة</Link></Button>
      </div>
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
        {products.map((product) => <ProductTile key={product.id} product={product} storeSlug={storeSlug} currencySettings={currencySettings} isPreview={isPreview} onAdd={onAdd} onBuy={onBuy} showcaseOnly={showcaseOnly} />)}
      </div>
    </section>
  );
}

function ProductGrid({ title, products, storeSlug, currencySettings, isPreview, onAdd, onBuy, showcaseOnly }: { title: string; products: StorefrontProduct[]; storeSlug: string; currencySettings: StoreCurrencySettings; isPreview: boolean; onAdd: (product: StorefrontProduct, quantity?: number, open?: boolean) => void; onBuy: (product: StorefrontProduct) => void; showcaseOnly?: boolean }) {
  return (
    <section className="rounded-[2rem] border bg-white p-5 shadow-card">
      <div className="mb-5 text-right"><h2 className="text-2xl font-black text-slate-950">{title}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{formatNumber(products.length)} نتيجة داخل هذا المتجر</p></div>
      {products.length ? <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{products.map((product) => <ProductTile key={product.id} product={product} storeSlug={storeSlug} currencySettings={currencySettings} isPreview={isPreview} onAdd={onAdd} onBuy={onBuy} compact showcaseOnly={showcaseOnly} />)}</div> : <EmptyStoreCatalog text="لا توجد نتائج مطابقة للبحث أو الفلتر الحالي." />}
    </section>
  );
}

function CategoryProductBlock({ group, storeSlug, currencySettings, isPreview, onAdd, onBuy, showcaseOnly }: { group: { category: StorefrontCategory; products: StorefrontProduct[] }; storeSlug: string; currencySettings: StoreCurrencySettings; isPreview: boolean; onAdd: (product: StorefrontProduct, quantity?: number, open?: boolean) => void; onBuy: (product: StorefrontProduct) => void; showcaseOnly?: boolean }) {
  return (
    <section id={`category-${group.category.slug}`} className="rounded-[2rem] border bg-white p-5 shadow-card">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-right">
        <div className="flex items-center gap-3"><div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-slate-100 p-1 font-black text-blue-600">{(group.category.previewImageUrl || group.category.imageUrl) ? <img src={group.category.previewImageUrl || group.category.imageUrl || ""} alt={group.category.name} className="h-full w-full object-contain" loading="lazy" decoding="async" /> : <Grid3X3 className="h-6 w-6" />}</div><div><h2 className="text-2xl font-black text-slate-950">{group.category.name}</h2><p className="mt-1 text-sm font-semibold text-slate-500">مجموعة منتجات منظمة داخل المتجر</p></div></div>
        <Badge variant="outline" className="bg-slate-50 px-4 py-2">{formatNumber(group.products.length)} منتجات</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {group.products.map((product) => <ProductTile key={product.id} product={product} storeSlug={storeSlug} currencySettings={currencySettings} isPreview={isPreview} onAdd={onAdd} onBuy={onBuy} compact showcaseOnly={showcaseOnly} />)}
      </div>
    </section>
  );
}

function ProductTile({ product, storeSlug, currencySettings, isPreview, onAdd, onBuy, compact = false, showcaseOnly = false }: { product: StorefrontProduct; storeSlug: string; currencySettings: StoreCurrencySettings; isPreview: boolean; onAdd: (product: StorefrontProduct, quantity?: number, open?: boolean) => void; onBuy: (product: StorefrontProduct) => void; compact?: boolean; showcaseOnly?: boolean }) {
  const href = `/store/${storeSlug}/products/${product.slug}${isPreview ? "?preview=1" : ""}`;
  const hasStock = product.defaultVariantStock == null || product.defaultVariantStock > 0;
  const hasSales = Number(product.soldCount || 0) > 0;
  return (
    <article className={`${compact ? "" : "min-w-[272px] snap-start"} group overflow-hidden rounded-[1.45rem] border border-slate-200/90 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl hover:shadow-slate-200/70`}>
      <Link href={href} prefetch={false} className="block" aria-label={`عرض ${product.name}`}>
        <ProductMediaFrame src={product.mainImageUrl} alt={product.name} className={compact ? "aspect-[4/5] min-h-[205px]" : "h-[292px] sm:h-[310px]"} imageClassName="p-2 transition duration-500 group-hover:scale-[1.035]">
          <div className="flex items-start justify-between p-2.5">
            <div>{product.showcaseStatus === "SOLD" ? <Badge className="bg-red-600 text-white shadow-lg">تم البيع</Badge> : hasSales ? <Badge className="bg-teal-600 text-white shadow-lg">الأكثر طلباً</Badge> : null}</div>
            {Number(product.viewCount || 0) > 0 ? <Badge className="bg-white/92 text-slate-800 shadow-sm"><Eye className="ml-1 h-3 w-3" /> {formatNumber(product.viewCount || 0)}</Badge> : null}
          </div>
          {!hasStock && product.showcaseStatus !== "SOLD" ? <span className="absolute bottom-2 right-2 rounded-full bg-slate-950/85 px-2.5 py-1 text-[10px] font-black text-white">نفد مؤقتاً</span> : null}
        </ProductMediaFrame>
      </Link>
      <div className="p-3.5 text-right sm:p-4">
        <Link href={href} prefetch={false}><h3 className="line-clamp-2 min-h-11 text-sm font-black leading-5 text-slate-950 transition hover:text-teal-700 sm:text-[15px]">{product.name}</h3></Link>
        <div className="mt-3 flex items-center justify-between gap-2">
          <CurrencyPrice amount={product.basePrice} settings={currencySettings} className="text-base font-black text-teal-700 sm:text-lg" />
          <span className="flex shrink-0 items-center gap-1 text-[11px] font-black text-amber-500"><Star className="h-3.5 w-3.5 fill-current" /> {formatNumber(product.ratingAverage || 0)}</span>
        </div>
        {isPreview && product.status !== "active" ? <Badge className="mt-3" variant="warning">{product.status}</Badge> : null}
        {product.showcaseStatus === "SOLD" ? (
          <div className="mt-3 rounded-xl bg-red-50 px-2 py-2 text-center text-[11px] font-black text-red-700">✓ تم بيع هذه القطعة</div>
        ) : product.productCommerceType === "SHOWCASE_ONLY" || showcaseOnly ? (
          <button type="button" onClick={() => onBuy(product)} className="mt-3 h-9 w-full rounded-xl border border-amber-200 bg-amber-50 text-xs font-black text-amber-800 transition hover:bg-amber-100">عرض التفاصيل والتواصل</button>
        ) : (
          <div className="mt-3 grid grid-cols-[1fr_42px] gap-2">
            <button type="button" onClick={() => onBuy(product)} className="h-10 rounded-xl border border-teal-100 bg-teal-50 px-2 text-xs font-black text-teal-800 transition hover:bg-teal-100">{product.defaultVariantId ? "شراء الآن" : "عرض التفاصيل"}</button>
            <button type="button" aria-label={`إضافة ${product.name} إلى السلة`} onClick={() => onAdd(product)} disabled={!product.defaultVariantId || !hasStock} className="grid h-10 w-[42px] place-items-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-600/25 transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-45"><ShoppingCart className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </article>
  );
}


function StoreBottomNavigation({ cartCount, onCart, onWhatsapp, showcaseOnly = false }: { cartCount: number; onCart: () => void; onWhatsapp: () => void; showcaseOnly?: boolean }) {
  return (
    <nav className="fixed bottom-3 left-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 rounded-[1.5rem] border bg-white/95 p-2 shadow-2xl backdrop-blur-xl md:hidden" aria-label="تنقل المتجر السفلي">
      <div className="grid grid-cols-5 gap-1 text-xs font-black text-slate-600">
        <a href="#store-ad-board" className="grid place-items-center gap-1 rounded-2xl p-2 hover:bg-slate-50"><Home className="h-5 w-5" /> الرئيسية</a>
        <a href="#store-search" className="grid place-items-center gap-1 rounded-2xl p-2 hover:bg-slate-50"><Search className="h-5 w-5" /> بحث</a>
        <a href="#store-categories" className="grid place-items-center gap-1 rounded-2xl p-2 hover:bg-slate-50"><Grid3X3 className="h-5 w-5" /> الأقسام</a>
        {showcaseOnly ? <a href="#store-products" className="grid place-items-center gap-1 rounded-2xl p-2 text-amber-600 hover:bg-amber-50"><Eye className="h-5 w-5" /> عرض</a> : <button type="button" onClick={onCart} className="relative grid place-items-center gap-1 rounded-2xl p-2 text-blue-600 hover:bg-blue-50"><ShoppingCart className="h-5 w-5" /> السلة{cartCount ? <span className="absolute right-2 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] text-white">{formatNumber(cartCount)}</span> : null}</button>}
        <button type="button" onClick={onWhatsapp} className="grid place-items-center gap-1 rounded-2xl p-2 text-emerald-600 hover:bg-emerald-50"><MessageCircle className="h-5 w-5" /> تواصل</button>
      </div>
    </nav>
  );
}

function EmptyStoreCatalog({ text = "ستظهر المنتجات هنا بعد إضافتها وتفعيلها من لوحة التاجر.", compact = false }: { text?: string; compact?: boolean }) {
  return (
    <div className={`grid ${compact ? "min-h-32" : "min-h-60"} place-items-center rounded-[2rem] border bg-white p-8 text-center shadow-card`}>
      <div>
        <PackageOpen className="mx-auto mb-4 h-12 w-12 text-slate-300" />
        <h2 className="text-2xl font-black text-slate-950">لا توجد منتجات</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">{text}</p>
      </div>
    </div>
  );
}

function buildSlides(store: StorefrontStore, gallery: StorefrontMedia[], announcements: StorefrontAnnouncement[]): Slide[] {
  const announcementSlides = announcements
    .filter((item) => item.imageUrl)
    .slice(0, 5)
    .map((item) => ({ id: `ad-${item.id}`, title: item.title, subtitle: item.summary || item.body, imageUrl: item.imageUrl || "", href: item.linkUrl || "#store-products", badge: item.isPromoted ? "إعلان ممول" : "إعلان المتجر" }));
  const mediaSlides = gallery
    .filter((item): item is StorefrontMedia & { url: string } => ["banner", "cover", "intro"].includes(item.mediaType || "") && Boolean(item.url))
    .slice(0, 5)
    .map((item, index) => ({ id: `media-${item.id || index}`, title: index === 0 ? `مرحباً بك في ${store.name}` : "مجموعة مختارة", subtitle: item.alt || store.description, imageUrl: item.url, href: "#store-products", badge: "واجهة المتجر" }));
  const slides = [...announcementSlides, ...mediaSlides].filter((slide, index, all) => all.findIndex((item) => item.imageUrl === slide.imageUrl) === index).slice(0, 7);
  if (!slides.length && store.coverImageUrl) {
    slides.push({ id: "store-cover", title: `مرحباً بك في ${store.name}`, subtitle: store.description, imageUrl: store.coverImageUrl, href: "#store-products", badge: "واجهة المتجر" });
  }
  return slides;
}
