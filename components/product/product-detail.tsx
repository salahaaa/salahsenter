"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, HelpCircle, Maximize2, MessageCircle, Minus, Plus, Share2, ShieldCheck, ShoppingCart, Star, Store, Truck, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { CurrencyPrice, CurrencySelector, CurrencySync } from "@/components/currency/currency-price";
import { ProductMediaFrame } from "@/components/product/product-media-frame";
import { MediaUrlInput } from "@/components/media/media-url-input";
import { defaultCurrencySettings, type StoreCurrencySettings } from "@/lib/currency-shared";
import { trackFunnelEvent } from "@/lib/funnel-client";

type Variant = {
  id: string;
  sku: string;
  barcode: string | null;
  title: string | null;
  price: string;
  compareAtPrice: string | null;
  priceAdjustment?: string;
  stockQuantity: number;
  imageUrl: string | null;
  images: string[];
  attributes: Record<string, string>;
};

type Image = { id: string; url: string; alt: string | null; isPrimary: boolean; attributeValueId: string | null; variantId: string | null; sortOrder: number };

type Product = {
  id: string;
  name: string;
  englishName: string | null;
  shortDescription: string | null;
  description: string | null;
  brand: string | null;
  warranty: string | null;
  originCountry: string | null;
  youtubeUrl: string | null;
  mainImageUrl: string | null;
  images: string[];
  ratingAverage: string | number;
  ratingCount: number;
  viewCount: number;
  discountPercent: string | number;
  specifications: Record<string, string>;
  productCommerceType?: string | null;
  showcaseStatus?: string | null;
  showcaseSoldAt?: string | Date | null;
  showcaseNote?: string | null;
  createdAt?: string | Date | null;
};

type StoreInfo = { id: string; name: string; slug: string; contactPhone?: string | null; whatsappUrl?: string | null; storeCommerceType?: string | null };

type Tab = "description" | "specs" | "reviews" | "questions" | "returns" | "store";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "description", label: "الوصف" },
  { id: "specs", label: "المواصفات" },
  { id: "reviews", label: "التقييمات" },
  { id: "questions", label: "الأسئلة والأجوبة" },
  { id: "returns", label: "سياسة الإرجاع" },
  { id: "store", label: "بيانات المتجر" }
];

function createOrderIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() || `order_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function ProductDetail({ product, variants, images, store, colorMap = {}, valueImageMap = {}, currencySettings = defaultCurrencySettings }: { product: Product; variants: Variant[]; images: Image[]; store: StoreInfo; colorMap?: Record<string, string>; valueImageMap?: Record<string, string>; currencySettings?: StoreCurrencySettings }) {
  const router = useRouter();
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id || "");
  const [activeImage, setActiveImage] = useState(product.mainImageUrl || "");
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<Tab>("description");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);

  useEffect(() => {
    trackFunnelEvent({ eventType: "product_view", productId: product.id, storeId: store.id, metadata: { source: "product_page" } });
  }, [product.id, store.id]);

  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) || variants[0];

  const gallery = useMemo(() => {
    const variantImages = selectedVariant ? images.filter((image) => image.variantId === selectedVariant.id).map((image) => image.url) : [];
    const linked = selectedVariant?.images || [];
    const general = images.filter((image) => !image.variantId).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder).map((image) => image.url);
    return [...new Set([...variantImages, ...linked, selectedVariant?.imageUrl || "", product.mainImageUrl || "", ...product.images, ...general].filter(Boolean))] as string[];
  }, [images, product.images, product.mainImageUrl, selectedVariant]);

  const shownImage = activeImage || gallery[0] || product.mainImageUrl;
  const attributeNames = useMemo(() => [...new Set(variants.flatMap((variant) => Object.keys(variant.attributes || {})))], [variants]);
  const currentAttributes = useMemo(() => selectedVariant?.attributes || {}, [selectedVariant]);
  const discount = Number(product.discountPercent || 0);
  const stock = selectedVariant?.stockQuantity || 0;
  const inStock = stock > 0;
  const isShowcaseOnly = product.productCommerceType === "SHOWCASE_ONLY";
  const isSold = product.showcaseStatus === "SOLD";

  // Availability matrix: for each attribute, determine which values are actually purchasable
  // given the shopper's current selections on the OTHER attributes. A value is:
  //  - exists    → some variant carries (currentOthers + thisValue)
  //  - inStock   → at least one such variant has stock > 0
  // Values that don't exist for the current selection are rendered disabled; values that
  // exist but are sold out are shown greyed with a strike. This is the Amazon/Noon behavior.
  const availability = useMemo(() => {
    const matrix = new Map<string, Map<string, { exists: boolean; inStock: boolean }>>();
    for (const attr of attributeNames) {
      const inner = new Map<string, { exists: boolean; inStock: boolean }>();
      for (const variant of variants) {
        const matchesOthers = Object.entries(currentAttributes)
          .filter(([key]) => key !== attr)
          .every(([key, val]) => variant.attributes?.[key] === val);
        if (!matchesOthers) continue;
        const value = variant.attributes?.[attr];
        if (value == null) continue;
        const entry = inner.get(value) || { exists: false, inStock: false };
        entry.exists = true;
        if ((variant.stockQuantity || 0) > 0) entry.inStock = true;
        inner.set(value, entry);
      }
      matrix.set(attr, inner);
    }
    return matrix;
  }, [attributeNames, currentAttributes, variants]);

  function showMessage(value: string) {
    setActionMessage(value);
    window.setTimeout(() => setActionMessage(null), 2600);
  }

  function getPageUrl() {
    return typeof window !== "undefined" ? window.location.href : `/store/${store.slug}`;
  }

  function addToLocalCart() {
    if (isShowcaseOnly || isSold) {
      showMessage(isSold ? "تم بيع هذا المنتج بالفعل." : "هذا المنتج للعرض فقط. تواصل مع المتجر أو زر زيارة المعرض.");
      return;
    }
    if (!selectedVariant) return;
    const item = {
      id: `${product.id}:${selectedVariant.id}`,
      productId: product.id,
      variantId: selectedVariant.id,
      storeId: store.id,
      storeSlug: store.slug,
      name: product.name,
      variantTitle: selectedVariant.title,
      href: getPageUrl(),
      imageUrl: shownImage || product.mainImageUrl,
      price: selectedVariant.price,
      storeName: store.name,
      quantity,
      attributes: selectedVariant.attributes || {},
      addedAt: new Date().toISOString()
    };
    const current = JSON.parse(localStorage.getItem("salah_center_cart") || "[]") as Array<typeof item>;
    const exists = current.find((row) => row.id === item.id);
    const next = exists ? current.map((row) => row.id === item.id ? { ...row, quantity: row.quantity + quantity, addedAt: item.addedAt } : row) : [item, ...current];
    localStorage.setItem("salah_center_cart", JSON.stringify(next));
    trackFunnelEvent({ eventType: "add_to_cart", productId: product.id, storeId: store.id, metadata: { source: "product_page", variantId: selectedVariant.id, cartItems: next.length } });
    window.dispatchEvent(new CustomEvent("salah-center-cart-updated", { detail: item }));
    showMessage("✓ تم إضافة المنتج للسلة المحلية");
  }

  async function buyNow() {
    if (isSold) return showMessage("تم بيع هذه القطعة بالفعل.");
    if (isShowcaseOnly) return openWhatsapp();
    if (!selectedVariant || !inStock || ordering) return;
    addToLocalCart();
    router.push("/checkout");
  }

  async function shareProduct() {
    const url = getPageUrl();
    const text = `${product.name} - ${store.name}`;
    try {
      if (navigator.share) await navigator.share({ title: product.name, text, url });
      else {
        await navigator.clipboard.writeText(url);
        showMessage("✓ تم نسخ رابط المنتج للمشاركة");
      }
    } catch {
      // المستخدم قد يغلق نافذة المشاركة، لا نعرض خطأ.
    }
  }

  function openWhatsapp() {
    const url = getPageUrl();
    const text = encodeURIComponent(`مرحباً، أريد الاستفسار عن المنتج: ${product.name}\n${url}`);
    const whatsappUrl = store.whatsappUrl || (store.contactPhone ? `https://wa.me/${store.contactPhone.replace(/[^0-9]/g, "")}` : "https://api.whatsapp.com/send");
    const separator = whatsappUrl.includes("?") ? "&" : "?";
    window.open(`${whatsappUrl}${separator}text=${text}`, "_blank", "noopener,noreferrer");
  }

  async function toggleFavorite() {
    const current = JSON.parse(localStorage.getItem("salah_center_favorites") || "[]") as Array<{ id: string }>;
    const exists = current.some((item) => item.id === product.id);
    const next = exists ? current.filter((item) => item.id !== product.id) : [{ id: product.id, name: product.name, href: getPageUrl(), imageUrl: shownImage, storeName: store.name, addedAt: new Date().toISOString() }, ...current];
    localStorage.setItem("salah_center_favorites", JSON.stringify(next));
    setFavorite(!exists);
    try {
      await fetch(exists ? `/api/wishlist/${product.id}` : "/api/wishlist", { method: exists ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: exists ? undefined : JSON.stringify({ productId: product.id }) });
    } catch {}
    showMessage(exists ? "تمت إزالة المنتج من المفضلة" : "✓ تمت إضافة المنتج للمفضلة");
  }

  function selectOption(attribute: string, value: string) {
    const desired = { ...currentAttributes, [attribute]: value };
    const exact = variants.find((variant) => Object.entries(desired).every(([key, option]) => variant.attributes?.[key] === option));
    const fallback = variants.find((variant) => variant.attributes?.[attribute] === value);
    const next = exact || fallback || selectedVariant;
    if (next) {
      setSelectedVariantId(next.id);
      // If this value has a dedicated image (e.g. a photo per color), show it on selection.
      const valueImage = valueImageMap[`${attribute}:${value}`] || valueImageMap[value];
      setActiveImage(valueImage || next.imageUrl || next.images?.[0] || product.mainImageUrl || gallery[0] || "");
    }
  }

  return (
    <>
    <div className="grid gap-8 lg:grid-cols-[1fr_.92fr]">
      <section className="rounded-[2rem] border bg-white p-4 shadow-card md:p-5">
        <div className="relative">
          <ProductMediaFrame src={shownImage} alt={product.name} className="aspect-[4/5] max-h-[650px] rounded-[1.7rem] sm:aspect-square" imageClassName="p-3 sm:p-5" priority />
          {isSold ? <Badge variant="danger" className="absolute right-4 top-4 bg-red-600 text-white">تم البيع</Badge> : discount > 0 ? <Badge variant="danger" className="absolute right-4 top-4">خصم {formatNumber(discount)}%</Badge> : null}
          <button type="button" aria-label="عرض الصورة بالحجم الكامل" onClick={() => setImageViewerOpen(true)} className="absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-slate-700 shadow-lg transition hover:bg-white"><Maximize2 className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {gallery.map((url) => <button key={url} type="button" onClick={() => setActiveImage(url)} className={`h-20 w-20 shrink-0 overflow-hidden rounded-2xl border bg-white ${shownImage === url ? "ring-2 ring-primary" : ""}`}><img src={url} alt="" className="h-full w-full object-contain p-1.5" /></button>)}
        </div>
        {product.youtubeUrl ? <a href={product.youtubeUrl} className="mt-4 block rounded-2xl bg-red-50 p-3 text-center text-sm font-black text-red-600" target="_blank" rel="noreferrer">مشاهدة فيديو المنتج</a> : null}
      </section>

      <section className="rounded-[2rem] border bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="gap-1"><Store className="h-3.5 w-3.5" /> {store.name}</Badge>{product.brand ? <Badge variant="secondary">{product.brand}</Badge> : null}{product.originCountry ? <Badge variant="outline">صنع في {product.originCountry}</Badge> : null}</div>
        <h1 className="mt-4 text-3xl font-black leading-tight text-slate-950 md:text-4xl">{product.name}</h1>
        {product.englishName ? <p className="mt-1 text-sm font-bold text-slate-400">{product.englishName}</p> : null}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><div className="flex flex-wrap items-center gap-4 text-sm font-bold text-slate-500"><span className="flex items-center gap-1 text-amber-500"><Star className="h-4 w-4 fill-current" /> {formatNumber(product.ratingAverage)}</span><span>{formatNumber(product.ratingCount)} مراجعة</span><span>{formatNumber(product.viewCount)} مشاهدة</span></div><div className="flex items-center gap-2"><CurrencySelector settings={currencySettings} /><CurrencySync settings={currencySettings} /></div></div>
        <div className="mt-6 flex flex-wrap items-end gap-3"><CurrencyPrice amount={selectedVariant?.price} settings={currencySettings} className="text-4xl font-black text-primary" />{selectedVariant?.compareAtPrice ? <CurrencyPrice amount={selectedVariant.compareAtPrice} settings={currencySettings} className="text-lg font-bold text-slate-400 line-through" /> : null}{discount > 0 ? <Badge variant="danger">وفر {formatNumber(discount)}%</Badge> : null}</div>
        <p className="mt-4 text-sm leading-7 text-slate-600">{product.shortDescription || product.description || "لا يوجد وصف مختصر."}</p>

        {attributeNames.length ? <div className="mt-6 space-y-5">{attributeNames.map((attr) => {
          const attrAvailability = availability.get(attr);
          const allValues = [...new Set(variants.map((v) => v.attributes?.[attr]).filter(Boolean))];
          return <div key={attr}><h3 className="mb-2 font-black text-slate-800">اختر {attr}</h3><div className="flex flex-wrap gap-2">{allValues.map((value) => {
          const isActive = currentAttributes[attr] === value;
          const info = attrAvailability?.get(value);
          // A value missing from the availability map means no variant carries
          // (currentOtherSelections + thisValue) → it is unavailable and must be disabled.
          const exists = info ? info.exists : false;
          const valueInStock = info ? info.inStock : false;
          const looksColor = /لون|color/i.test(attr);
          const color = colorMap[value] || colorMap[`${attr}:${value}`] || getColorHex(value);
          // Unavailable = no variant matches current selection + this value → disabled.
          // Sold out = a matching variant exists but none in stock → greyed + strike.
          const disabled = !exists;
          const soldOut = exists && !valueInStock;
          const base = looksColor ? "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-black transition" : "rounded-xl border px-4 py-2 text-sm font-bold transition";
          const state = disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300 line-through"
            : soldOut
              ? looksColor ? "border-slate-200 bg-slate-50 text-slate-400 opacity-60 hover:opacity-100" : "border-slate-200 bg-slate-50 text-slate-400 line-through"
              : isActive
                ? "border-primary bg-blue-50 text-primary"
                : looksColor ? "border-slate-200 bg-white hover:bg-slate-50" : "bg-white hover:bg-slate-50";
          return <button key={value} type="button" disabled={disabled} onClick={() => !disabled && selectOption(attr, value)} className={`${base} ${state}`} title={soldOut ? `${value} — نفد من هذه التركيبة` : disabled ? `${value} — غير متاح مع الاختيار الحالي` : value}>{looksColor ? <><span className={`relative block h-7 w-7 rounded-full border shadow-sm ${soldOut ? "opacity-50" : ""}`} style={{ backgroundColor: color }}>{soldOut ? <span className="absolute inset-0 rounded-full ring-2 ring-red-400 ring-offset-1" /> : null}</span><span>{value}</span></> : value}</button>;
        })}</div></div>;
        })}</div> : null}

        <div className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold md:grid-cols-2"><span className={inStock ? "text-emerald-600" : "text-red-600"}>{inStock ? `متوفر: ${formatNumber(stock)} قطعة` : "غير متوفر"}</span><span>SKU: {selectedVariant?.sku || "-"}</span>{selectedVariant?.barcode ? <span>Barcode: {selectedVariant.barcode}</span> : null}<span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-emerald-500" /> ضمان: {product.warranty || "غير محدد"}</span></div>

        {isSold ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5">
            <Badge className="mb-3 bg-red-600 text-white">✓ تم البيع</Badge>
            <p className="text-sm font-bold leading-7 text-red-900">{product.showcaseNote || "تم بيع هذه القطعة عبر المركز التجاري اليمني."}</p>
            {product.showcaseSoldAt ? <p className="mt-2 text-xs font-black text-red-700">تاريخ البيع: {new Date(product.showcaseSoldAt).toLocaleDateString("ar")}</p> : null}
            {product.createdAt && product.showcaseSoldAt ? <p className="mt-1 text-xs font-bold text-red-700">مدة بقاء المنتج قبل البيع: {Math.max(1, Math.ceil((new Date(product.showcaseSoldAt).getTime() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24)))} يوم</p> : null}
            <div className="mt-4 flex flex-wrap gap-3"><Button asChild variant="outline"><Link href={`/store/${store.slug}`}>زيارة المتجر</Link></Button><Button type="button" variant="outline" onClick={shareProduct}><Share2 className="h-4 w-4" /> مشاركة</Button></div>
          </div>
        ) : isShowcaseOnly ? (
          <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <Badge className="mb-3 bg-amber-500 text-white">عرض فقط</Badge>
            <p className="text-sm font-bold leading-7 text-amber-900">هذا المنتج للعرض داخل المتجر فقط. يمكنك التواصل مع المتجر لمعرفة السعر النهائي أو زيارة المعرض.</p>
            <div className="mt-4 flex flex-wrap gap-3"><Button type="button" onClick={openWhatsapp}><MessageCircle className="h-5 w-5" /> تواصل مع المتجر</Button>{store.contactPhone ? <Button asChild variant="outline"><a href={`tel:${store.contactPhone}`}>اتصال</a></Button> : null}<Button asChild variant="outline"><Link href={`/store/${store.slug}`}>زيارة المتجر</Link></Button></div>
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex h-12 items-center overflow-hidden rounded-2xl border bg-white shadow-sm" aria-label="اختيار الكمية">
              <button type="button" aria-label="إنقاص الكمية" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setQuantity((q) => Math.max(1, Number(q || 1) - 1)); }} className="grid h-12 w-12 place-items-center text-slate-700 transition hover:bg-slate-50 active:scale-95"><Minus className="h-4 w-4" /></button>
              <input type="number" min={1} max={stock || 99} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(stock || 99, Number(event.target.value || 1))))} className="h-12 w-16 border-x bg-white text-center text-sm font-black outline-none" />
              <button type="button" aria-label="زيادة الكمية" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setQuantity((q) => Math.min(stock || 99, Number(q || 1) + 1)); }} className="grid h-12 w-12 place-items-center text-slate-700 transition hover:bg-slate-50 active:scale-95"><Plus className="h-4 w-4" /></button>
            </div>
            <Button type="button" size="lg" disabled={!inStock || !selectedVariant} onClick={addToLocalCart}><ShoppingCart className="h-5 w-5" /> أضف للسلة</Button>
            <Button type="button" size="lg" variant="secondary" disabled={!inStock || !selectedVariant || ordering} onClick={buyNow}><Zap className="h-5 w-5" /> {ordering ? "جارٍ إنشاء الطلب..." : "اشتر الآن"}</Button>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-3"><Button size="sm" variant="outline" onClick={toggleFavorite}><Heart className={`h-4 w-4 ${favorite ? "fill-current text-red-500" : ""}`} /> المفضلة</Button><Button size="sm" variant="outline" onClick={shareProduct}><Share2 className="h-4 w-4" /> مشاركة</Button><Button size="sm" variant="outline" onClick={openWhatsapp}><MessageCircle className="h-4 w-4" /> واتساب</Button></div>
        {actionMessage ? <p className="mt-4 rounded-2xl border bg-slate-50 p-3 text-sm font-black text-slate-700">{actionMessage}</p> : null}
      </section>

      <section className="rounded-[2rem] border bg-white p-6 shadow-card lg:col-span-2">
        <div className="mb-6 flex gap-2 overflow-x-auto border-b pb-3">{tabs.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-black ${activeTab === tab.id ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}>{tab.label}</button>)}</div>
        <TabContent activeTab={activeTab} product={product} storeName={store.name} />
      </section>
    </div>
    {imageViewerOpen && shownImage ? <div role="dialog" aria-modal="true" aria-label={`صورة ${product.name}`} className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/90 p-4 backdrop-blur-sm" onClick={() => setImageViewerOpen(false)}><div className="relative flex h-full w-full max-w-5xl items-center justify-center" onClick={(event) => event.stopPropagation()}><img src={shownImage} alt={product.name} className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl" /><button type="button" aria-label="إغلاق الصورة" onClick={() => setImageViewerOpen(false)} className="absolute left-2 top-2 grid h-11 w-11 place-items-center rounded-full bg-white text-slate-900 shadow-lg"><X className="h-5 w-5" /></button></div></div> : null}
    </>
  );
}

function TabContent({ activeTab, product, storeName }: { activeTab: Tab; product: Product; storeName: string }) {
  if (activeTab === "description") return <p className="whitespace-pre-wrap text-sm leading-8 text-slate-600">{product.description || "لا يوجد وصف."}</p>;
  if (activeTab === "specs") return <dl className="grid gap-3 md:grid-cols-2">{Object.entries(product.specifications || {}).map(([k, v]) => <div key={k} className="flex justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm"><dt className="font-bold text-slate-500">{k}</dt><dd className="font-black">{v}</dd></div>)}</dl>;
  if (activeTab === "reviews") return <ReviewsPanel productId={(product as any).id} />;
  if (activeTab === "questions") return <QuestionsPanel productId={product.id} />;
  if (activeTab === "returns") return <div className="grid gap-4 md:grid-cols-2"><InfoCard icon={<Truck className="h-5 w-5" />} title="الشحن" text="سياسة الشحن تُدار من إعدادات المتجر وتظهر للعميل هنا." /><InfoCard icon={<ShieldCheck className="h-5 w-5" />} title="الإرجاع والضمان" text={`المنتج يخضع لضمان: ${product.warranty || "غير محدد"}. يمكن تخصيص سياسة الإرجاع من إعدادات المتجر.`} /></div>;
  return <InfoCard icon={<Store className="h-5 w-5" />} title={storeName} text="متجر معتمد داخل المول. يمكنك زيارة صفحة المتجر لاستعراض جميع المنتجات والعروض." />;
}


function QuestionsPanel({ productId }: { productId: string }) {
  const [questions, setQuestions] = useState<Array<{ id: string; question: string; userName: string; createdAt: string; answers: Array<{ id: string; answer: string; userName: string; createdAt: string }> }>>([]);
  const [question, setQuestion] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch(`/api/products/${productId}/questions`, { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => { if (active) setQuestions(json?.data?.questions || []); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [productId]);
  async function submit() {
    const response = await fetch(`/api/products/${productId}/questions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم إرسال سؤالك؛ سيظهر بعد اعتماد المتجر والرد عليه." : json.message || "سجّل الدخول لطرح سؤال أو تحقق من النص.");
    if (response.ok) setQuestion("");
  }
  return <div className="space-y-5"><div className="rounded-2xl bg-slate-50 p-4"><h3 className="font-black">اسأل التاجر عن هذا المنتج</h3><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="مثال: هل الضمان محلي؟ وهل المنتج متوفر بلون آخر؟" className="h-11 flex-1 rounded-xl border bg-white px-3 text-sm"/><Button type="button" onClick={submit} disabled={question.trim().length < 5}>إرسال السؤال</Button></div>{message ? <p className="mt-2 text-xs font-bold text-slate-600">{message}</p> : null}</div>{questions.length ? <div className="space-y-3">{questions.map((item) => <article key={item.id} className="rounded-2xl border bg-white p-4"><p className="font-black text-slate-950">{item.question}</p><p className="mt-1 text-xs text-slate-500">{item.userName}</p>{item.answers.length ? <div className="mt-3 space-y-2 border-r-2 border-primary/30 pr-3">{item.answers.map((answer) => <div key={answer.id}><p className="text-sm font-bold text-primary">رد {answer.userName}</p><p className="mt-1 text-sm leading-6 text-slate-600">{answer.answer}</p></div>)}</div> : <p className="mt-3 text-xs font-bold text-amber-700">بانتظار رد التاجر.</p>}</article>)}</div> : <EmptyPanel icon={<HelpCircle className="h-6 w-6" />} title="لا توجد أسئلة بعد" text="كن أول من يسأل التاجر عن التفاصيل التي تهمك." />}</div>;
}

function ReviewsPanel({ productId }: { productId: string }) {
  type Review = { id: string; rating: number; comment: string | null; userName: string; createdAt: string; media: Array<{ id: string; url: string }>; reply: { body: string; createdAt: string } | null };
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const load = useCallback(async () => { const json = await fetch(`/api/reviews?productId=${productId}`, { cache: "no-store" }).then((response) => response.json()).catch(() => null); if (json?.success) setReviews(json.data?.reviews || []); }, [productId]);
  useEffect(() => { void load(); }, [load]);
  async function submit() {
    const response = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, rating, comment, mediaUrls: mediaUrl ? [mediaUrl] : [] }) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم إرسال تقييمك للمراجعة قبل النشر" : json.message || "تعذر إرسال التقييم");
    if (response.ok) { setComment(""); setMediaUrl(""); await load(); }
  }
  async function report(reviewId: string) {
    const reason = window.prompt("سبب البلاغ: spam / abuse / fake / privacy / other", "spam");
    if (!reason || !["spam", "abuse", "fake", "privacy", "other"].includes(reason)) return;
    const response = await fetch(`/api/reviews/${reviewId}/reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم إرسال البلاغ للمراجعة" : json.message || "تعذر إرسال البلاغ");
  }
  return <div className="space-y-5"><div className="rounded-2xl bg-slate-50 p-4"><h3 className="font-black">أضف تقييمك بعد الشراء</h3><div className="mt-3 flex flex-wrap gap-2"><select value={rating} onChange={(e)=>setRating(Number(e.target.value))} className="h-10 rounded-xl border bg-white px-3 text-sm">{[5,4,3,2,1].map((v)=><option key={v} value={v}>{v} نجوم</option>)}</select><input value={comment} onChange={(e)=>setComment(e.target.value)} placeholder="رأيك في المنتج" className="h-10 min-w-52 flex-1 rounded-xl border bg-white px-3 text-sm"/><Button type="button" size="sm" onClick={submit}>إرسال</Button></div><div className="mt-3"><MediaUrlInput label="صورة تقييم اختيارية" name="reviewMedia" value={mediaUrl} onValueChange={setMediaUrl} folder="reviews/customer-media" accept="image/*" /></div>{message ? <p className="mt-2 text-xs font-bold text-slate-600">{message}</p> : null}</div>{reviews.length ? <div className="space-y-3">{reviews.map((review)=><article key={review.id} className="rounded-2xl border bg-white p-4"><div className="flex items-center justify-between"><b>{review.userName}</b><span className="text-amber-500">{"★".repeat(review.rating)}</span></div>{review.comment ? <p className="mt-2 text-sm leading-6 text-slate-600">{review.comment}</p> : null}{review.media.length ? <div className="mt-3 flex gap-2 overflow-x-auto">{review.media.map((media) => <img key={media.id} src={media.url} alt="صورة من تقييم العميل" className="h-20 w-20 rounded-xl border bg-slate-50 object-contain p-1" />)}</div> : null}{review.reply ? <div className="mt-3 rounded-xl border-r-2 border-teal-400 bg-teal-50 p-3 text-sm"><b className="text-teal-800">رد المتجر</b><p className="mt-1 text-teal-900">{review.reply.body}</p></div> : null}<button type="button" onClick={() => void report(review.id)} className="mt-3 text-xs font-bold text-slate-400 underline hover:text-red-600">الإبلاغ عن هذا التقييم</button></article>)}</div> : <EmptyPanel icon={<Star className="h-6 w-6" />} title="لا توجد تقييمات منشورة بعد" text="تُنشر التقييمات بعد مراجعتها." />}</div>;
}

function getColorHex(value: string) {
  const normalized = value.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي");
  if (normalized.includes("ابيض") || normalized.includes("white")) return "#ffffff";
  if (normalized.includes("اسود") || normalized.includes("black")) return "#111827";
  if (normalized.includes("وردي") || normalized.includes("ورد") || normalized.includes("pink")) return "#f9a8d4";
  if (normalized.includes("رمادي") || normalized.includes("رصاص") || normalized.includes("مادي") || normalized.includes("gray") || normalized.includes("grey")) return "#94a3b8";
  if (normalized.includes("بيج") || normalized.includes("beige")) return "#d6c2a3";
  if (normalized.includes("بني") || normalized.includes("brown")) return "#7c4a2d";
  if (normalized.includes("ذهبي") || normalized.includes("gold")) return "#fbbf24";
  if (normalized.includes("فضي") || normalized.includes("silver")) return "#cbd5e1";
  if (normalized.includes("احمر") || normalized.includes("red")) return "#ef4444";
  if (normalized.includes("ازرق") || normalized.includes("blue")) return "#3b82f6";
  if (normalized.includes("اخضر") || normalized.includes("green")) return "#22c55e";
  return "#e2e8f0";
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="rounded-2xl bg-slate-50 p-5"><div className="mb-3 flex items-center gap-2 font-black text-slate-900">{icon} {title}</div><p className="text-sm leading-7 text-slate-600">{text}</p></div>; }
function EmptyPanel({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="grid min-h-40 place-items-center rounded-2xl bg-slate-50 p-8 text-center"><div><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-white text-slate-500">{icon}</div><h3 className="font-black">{title}</h3><p className="mt-2 text-sm text-slate-500">{text}</p></div></div>; }
