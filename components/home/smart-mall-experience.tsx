"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { ArrowLeft, BadgePercent, Camera, Compass, Image as ImageIcon, MapPin, Minus, Navigation, Plus, Search, Sparkles, Star, Store, Wand2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SmartSearchBox } from "@/components/search/smart-search-box";
import { cn, formatCurrency, formatNumber, getInitials } from "@/lib/utils";

type AnyRecord = Record<string, any>;

type MapNode = {
  id: string;
  type: "wing" | "store";
  title: string;
  subtitle: string;
  href: string;
  imageUrl?: string | null;
  x: number;
  y: number;
  score: number;
};

const interestKey = "salah_center_smart_mall_interests_v1";

export function SmartMallExperience({ wings, stores, products, offers }: { wings: AnyRecord[]; stores: AnyRecord[]; products: AnyRecord[]; offers: AnyRecord[] }) {
  function openVisualAssistant() {
    window.dispatchEvent(new CustomEvent("salah-center-open-assistant", { detail: { mode: "visual" } }));
  }

  return (
    <section className="bg-white py-6" id="smart-mall-shortcuts">
      <div className="mx-auto max-w-7xl px-4">
        <div className="grid gap-3 rounded-[2rem] border bg-gradient-to-l from-slate-950 via-slate-900 to-blue-950 p-4 text-white shadow-2xl shadow-slate-900/10 lg:grid-cols-[1.2fr_2fr] lg:items-center">
          <div className="text-right">
            <Badge className="mb-3 bg-white/10 text-white"><Sparkles className="ml-1 h-4 w-4 text-amber-300" /> أدوات ذكية مختصرة</Badge>
            <h2 className="text-2xl font-black md:text-3xl">أدوات سريعة للوصول والتسوق الذكي</h2>
            <p className="mt-2 text-sm font-semibold leading-7 text-white/65">اختر الأداة المناسبة لك بسرعة، بينما تبقى الصفحة الرئيسية مرتبة للعروض والمتاجر والمنتجات المهمة.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <QuickActionCard href="/smart-map" icon={<MapPin className="h-5 w-5" />} title="الخريطة الذكية" text={`${formatNumber(wings.length)} جناح و ${formatNumber(stores.length)} متجر`} />
            <button type="button" onClick={openVisualAssistant} className="group rounded-3xl border border-white/10 bg-white/10 p-4 text-right transition hover:-translate-y-1 hover:bg-white hover:text-slate-950">
              <span className="mb-3 inline-grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-amber-300 group-hover:bg-blue-50 group-hover:text-blue-600"><ImageIcon className="h-5 w-5" /></span>
              <span className="block font-black">البحث بالصور</span>
              <span className="mt-1 block text-xs font-bold text-white/55 group-hover:text-slate-500">داخل مساعد التسوق</span>
            </button>
            <QuickActionCard href="/offers" icon={<BadgePercent className="h-5 w-5" />} title="العروض الممولة" text={`${formatNumber(offers.length)} عرض/حملة`} />
            <QuickActionCard href="/merchant/ads" icon={<Zap className="h-5 w-5" />} title="روّج متجرك" text="مساحة إيرادية للتجار" />
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickActionCard({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link href={href} prefetch={false} className="group rounded-3xl border border-white/10 bg-white/10 p-4 text-right transition hover:-translate-y-1 hover:bg-white hover:text-slate-950">
      <span className="mb-3 inline-grid h-11 w-11 place-items-center rounded-2xl bg-white/15 text-amber-300 group-hover:bg-blue-50 group-hover:text-blue-600">{icon}</span>
      <span className="block font-black">{title}</span>
      <span className="mt-1 block text-xs font-bold text-white/55 group-hover:text-slate-500">{text}</span>
    </Link>
  );
}

export function SmartMallMapWorkspace({ wings, stores, products, offers }: { wings: AnyRecord[]; stores: AnyRecord[]; products: AnyRecord[]; offers: AnyRecord[] }) {
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [visualPreview, setVisualPreview] = useState<string | null>(null);
  const [visualResults, setVisualResults] = useState<AnyRecord[]>([]);
  const [visualLoading, setVisualLoading] = useState(false);

  useEffect(() => {
    try {
      setInterests(JSON.parse(localStorage.getItem(interestKey) || "[]"));
    } catch {
      setInterests([]);
    }
  }, []);

  const mapNodes = useMemo(() => buildMapNodes(wings, stores), [wings, stores]);
  const visualCategories = useMemo(() => wings.slice(0, 8), [wings]);
  const recommendedProducts = useMemo(() => rankProducts(products, interests), [products, interests]);
  const discoveryFeed = useMemo(() => buildDiscoveryFeed({ stores, products, offers, wings }), [stores, products, offers, wings]);

  function rememberInterest(value?: string | null) {
    if (!value) return;
    const tokens = value.split(/\s+/).filter((token) => token.length > 2).slice(0, 4);
    const next = [...new Set([...tokens, ...interests])].slice(0, 16);
    setInterests(next);
    try {
      localStorage.setItem(interestKey, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }

  async function handleVisualSearch(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setVisualPreview(preview);
    setVisualLoading(true);
    const query = file.name.replace(/[-_.]/g, " ").replace(/\.(png|jpe?g|webp|gif)$/i, "") || "منتج مشابه";
    try {
      const response = await fetch(`/api/search/advanced?q=${encodeURIComponent(query)}&limit=6&source=visual_discovery`);
      const json = await response.json();
      setVisualResults(response.ok ? json.data?.products || [] : []);
      rememberInterest(query);
    } catch {
      setVisualResults([]);
    } finally {
      setVisualLoading(false);
    }
  }

  return (
    <section className="relative overflow-hidden bg-[radial-gradient(circle_at_12%_0%,rgba(59,130,246,.10),transparent_28%),linear-gradient(180deg,#fff_0%,#f8fafc_100%)] py-8" id="smart-map-page">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 flex flex-col gap-4 text-right md:flex-row md:items-end md:justify-between">
          <div>
            <Badge className="mb-4 bg-slate-950 text-white"><Sparkles className="ml-1 h-4 w-4" /> Smart Mall Map</Badge>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-5xl">الخريطة الذكية والبحث البصري</h1>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-slate-500 md:text-base">هذه الصفحة مخصصة للأدوات الكبيرة حتى تبقى الصفحة الرئيسية خفيفة ومخصصة للعروض والإعلانات والمتاجر.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/" prefetch={false}>العودة للرئيسية</Link></Button>
            <Button asChild><Link href="#visual-search">البحث بالصور</Link></Button>
          </div>
        </div>

        <div id="smart-search" className="mb-8 grid gap-4 rounded-[2rem] border bg-white/85 p-4 shadow-card backdrop-blur-xl lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0"><SmartSearchBox variant="hero" placeholder="ابحث باسم المنتج، المتجر، الوصف أو الاستخدام المطلوب..." /></div>
          <div className="flex flex-wrap justify-end gap-2 text-xs font-black">
            {["منتجات", "متاجر", "عروض", "أقسام", "الأكثر طلباً"].map((item) => <a key={item} href="#smart-feed" onClick={() => rememberInterest(item)} className="rounded-full bg-slate-100 px-4 py-2 text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">{item}</a>)}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
          <SmartMap nodes={mapNodes} selectedNode={selectedNode} onSelect={(node) => { setSelectedNode(node); rememberInterest(node.title); }} zoom={zoom} setZoom={setZoom} />
          <RecommendationPanel products={recommendedProducts} stores={stores} interests={interests} onPick={rememberInterest} />
        </div>

        <VisualCategories wings={visualCategories} onPick={rememberInterest} />
        <DiscoveryFeed items={discoveryFeed} onPick={rememberInterest} />
        <VisualSearchPanel preview={visualPreview} results={visualResults} loading={visualLoading} onUpload={handleVisualSearch} onPick={rememberInterest} />
      </div>
    </section>
  );
}

function SmartMap({ nodes, selectedNode, onSelect, zoom, setZoom }: { nodes: MapNode[]; selectedNode: MapNode | null; onSelect: (node: MapNode) => void; zoom: number; setZoom: (next: number) => void }) {
  return (
    <div className="overflow-hidden rounded-[2rem] border bg-white p-4 shadow-card md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-right">
          <h3 className="flex items-center gap-2 text-xl font-black text-slate-950"><MapPin className="h-5 w-5 text-blue-600" /> الخريطة الذكية للمول</h3>
          <p className="mt-1 text-sm text-slate-500">اضغط على الجناح أو المتجر لعرض المسار والتفاصيل.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="icon" variant="outline" onClick={() => setZoom(Math.max(.82, zoom - .1))}><Minus className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="outline" onClick={() => setZoom(Math.min(1.35, zoom + .1))}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="smart-map-scroll overflow-auto rounded-[1.5rem] border bg-slate-950 p-3">
        <div className="relative h-[440px] min-w-[720px] overflow-hidden rounded-[1.25rem] bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,.28),transparent_25%),radial-gradient(circle_at_80%_35%,rgba(245,158,11,.22),transparent_24%),linear-gradient(135deg,#020617,#0f172a)]" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
          <div className="absolute bottom-5 right-6 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-lg"><Navigation className="ml-2 inline h-4 w-4 text-blue-600" /> بوابة الدخول</div>
          {selectedNode ? <RouteLine node={selectedNode} /> : null}
          {nodes.map((node) => <MapNodeButton key={`${node.type}-${node.id}`} node={node} selected={selectedNode?.id === node.id && selectedNode?.type === node.type} onClick={() => onSelect(node)} />)}
        </div>
      </div>
      {selectedNode ? (
        <div className="mt-4 rounded-3xl border bg-slate-50 p-4 text-right">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge variant="outline">{selectedNode.type === "wing" ? "جناح" : "متجر"}</Badge>
              <h4 className="mt-2 text-lg font-black text-slate-950">{selectedNode.title}</h4>
              <p className="mt-1 text-sm text-slate-500">{selectedNode.subtitle}</p>
            </div>
            <Button asChild><Link href={selectedNode.href} prefetch={false}>فتح الوجهة <ArrowLeft className="h-4 w-4" /></Link></Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RouteLine({ node }: { node: MapNode }) {
  const startX = 86;
  const startY = 385;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full">
      <path d={`M ${startX} ${startY} C ${startX + 150} ${startY - 80}, ${node.x - 120} ${node.y + 70}, ${node.x} ${node.y}`} fill="none" stroke="rgba(250,204,21,.85)" strokeWidth="5" strokeDasharray="12 10" />
    </svg>
  );
}

function MapNodeButton({ node, selected, onClick }: { node: MapNode; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3 py-2 text-right text-xs font-black text-white shadow-xl backdrop-blur transition hover:scale-105", node.type === "wing" ? "border-blue-300/40 bg-blue-500/30" : "border-amber-300/40 bg-amber-500/30", selected ? "ring-4 ring-white/50" : "")} style={{ left: node.x, top: node.y }}>
      <span className="block max-w-[130px] truncate">{node.title}</span>
      <span className="block text-[10px] text-white/65">نشاط {formatNumber(node.score)}</span>
    </button>
  );
}

function RecommendationPanel({ products, stores, interests, onPick }: { products: AnyRecord[]; stores: AnyRecord[]; interests: string[]; onPick: (value?: string | null) => void }) {
  return (
    <div className="rounded-[2rem] border bg-white p-5 shadow-card">
      <h3 className="flex items-center gap-2 text-xl font-black text-slate-950"><Wand2 className="h-5 w-5 text-violet-600" /> توصيات ذكية لك</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">تعتمد على الرائج وما بحثت عنه أو فتحته داخل المول.</p>
      {interests.length ? <div className="mt-3 flex flex-wrap gap-2">{interests.slice(0, 6).map((item) => <span key={item} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">{item}</span>)}</div> : null}
      <div className="mt-5 space-y-3">
        {products.slice(0, 4).map((product) => <RecommendationProduct key={product.id} product={product} onPick={onPick} />)}
        {!products.length ? stores.slice(0, 4).map((store) => <RecommendationStore key={store.id || store.slug} store={store} onPick={onPick} />) : null}
      </div>
    </div>
  );
}

function RecommendationProduct({ product, onPick }: { product: AnyRecord; onPick: (value?: string | null) => void }) {
  return (
    <Link href={`/store/${product.storeSlug || "store"}/products/${product.slug}`} prefetch={false} onClick={() => onPick(product.name)} className="flex gap-3 rounded-2xl border bg-slate-50 p-3 transition hover:bg-blue-50">
      <Thumb src={product.mainImageUrl} title={product.name} />
      <div className="min-w-0 flex-1 text-right"><p className="truncate font-black text-slate-950">{product.name}</p><p className="mt-1 text-xs text-slate-500">{product.storeName || "متجر"}</p><p className="mt-2 font-black text-primary">{product.basePrice ? formatCurrency(product.basePrice) : "حسب المتغير"}</p></div>
    </Link>
  );
}

function RecommendationStore({ store, onPick }: { store: AnyRecord; onPick: (value?: string | null) => void }) {
  return (
    <Link href={`/store/${store.slug}`} prefetch={false} onClick={() => onPick(store.name)} className="flex gap-3 rounded-2xl border bg-slate-50 p-3 transition hover:bg-blue-50">
      <Thumb src={store.logoUrl || store.coverImageUrl} title={store.name} />
      <div className="min-w-0 flex-1 text-right"><p className="truncate font-black text-slate-950">{store.name}</p><p className="mt-1 text-xs text-slate-500">متجر داخل المول</p><p className="mt-2 text-xs font-bold text-amber-500">★ {formatNumber(store.ratingAverage || 0)}</p></div>
    </Link>
  );
}

function VisualCategories({ wings, onPick }: { wings: AnyRecord[]; onPick: (value?: string | null) => void }) {
  if (!wings.length) return null;
  return (
    <section className="mt-10" id="visual-categories">
      <div className="mb-5 flex items-center justify-between gap-3 text-right"><div><h3 className="text-2xl font-black text-slate-950">تصنيفات بصرية سريعة</h3><p className="mt-1 text-sm text-slate-500">بدلاً من القوائم النصية، ادخل للقسم بصرياً وبنقرة واحدة.</p></div><Compass className="h-8 w-8 text-blue-600" /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {wings.map((wing, index) => <Link key={wing.id || wing.slug} href={`/wings/${wing.slug}`} prefetch={false} onClick={() => onPick(wing.name)} className="group overflow-hidden rounded-3xl border bg-white shadow-card transition hover:-translate-y-1 hover:shadow-soft"><div className="relative h-40 bg-slate-100"><img src={wing.heroImageUrl || wing.desktopImageUrl || wing.mobileImageUrl || fallbackImage(index)} alt={wing.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" /><div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" /><div className="absolute bottom-4 right-4 text-right text-white"><p className="text-lg font-black">{wing.name}</p><p className="text-xs text-white/70">{formatNumber(wing.storeCount || 0)} متجر</p></div></div></Link>)}
      </div>
    </section>
  );
}

function DiscoveryFeed({ items, onPick }: { items: AnyRecord[]; onPick: (value?: string | null) => void }) {
  if (!items.length) return null;
  return (
    <section className="mt-10" id="smart-feed">
      <div className="mb-5 flex items-center justify-between text-right"><div><h3 className="text-2xl font-black text-slate-950">تغذية الاكتشاف الذكية</h3><p className="mt-1 text-sm text-slate-500">منتجات رائجة، متاجر جديدة، عروض وأقسام مقترحة في مسار واحد.</p></div><Zap className="h-8 w-8 text-amber-500" /></div>
      <div className="flex gap-4 overflow-x-auto pb-3">
        {items.map((item, index) => <FeedCard key={`${item.kind}-${item.id || item.href}-${index}`} item={item} onPick={onPick} />)}
      </div>
    </section>
  );
}

function FeedCard({ item, onPick }: { item: AnyRecord; onPick: (value?: string | null) => void }) {
  return (
    <Link href={item.href} prefetch={false} onClick={() => onPick(item.title)} className="group min-w-[280px] overflow-hidden rounded-3xl border bg-white shadow-card transition hover:-translate-y-1 hover:shadow-soft">
      <div className="relative h-44 bg-slate-100"><img src={item.imageUrl || fallbackImage(1)} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" decoding="async" /><Badge className="absolute right-3 top-3 bg-white/90 text-slate-800">{item.label}</Badge></div>
      <div className="p-4 text-right"><h4 className="line-clamp-2 font-black text-slate-950">{item.title}</h4><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{item.subtitle}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-black text-primary">فتح <ArrowLeft className="h-4 w-4" /></span></div>
    </Link>
  );
}

function VisualSearchPanel({ preview, results, loading, onUpload, onPick }: { preview: string | null; results: AnyRecord[]; loading: boolean; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; onPick: (value?: string | null) => void }) {
  return (
    <section className="mt-10 overflow-hidden rounded-[2rem] border bg-slate-950 p-5 text-white shadow-2xl" id="visual-search">
      <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
        <div className="text-right"><Badge className="mb-4 bg-white/10 text-white"><Camera className="ml-1 h-4 w-4" /> بحث بصري</Badge><h3 className="text-3xl font-black">ابحث عن منتجات مشابهة بالصورة</h3><p className="mt-3 text-sm leading-7 text-white/60">ارفع صورة المنتج أو اكتب وصفاً مختصراً، وستظهر لك نتائج قريبة داخل المول.</p><Button type="button" variant="secondary" className="relative mt-5 overflow-hidden"><ImageIcon className="h-4 w-4" /> رفع صورة للبحث<input type="file" accept="image/*" onChange={onUpload} className="absolute inset-0 cursor-pointer opacity-0" /></Button></div>
        <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
          {preview ? <img src={preview} alt="صورة البحث" className="mb-4 h-52 w-full rounded-2xl object-cover" /> : <div className="mb-4 grid h-52 place-items-center rounded-2xl bg-white/10 text-white/45"><Search className="h-12 w-12" /></div>}
          {loading ? <p className="text-sm font-bold text-white/70">جارٍ البحث عن منتجات مشابهة...</p> : results.length ? <div className="grid gap-3 md:grid-cols-2">{results.slice(0, 4).map((product) => <RecommendationProduct key={product.id} product={product} onPick={onPick} />)}</div> : <p className="text-sm font-bold text-white/55">ستظهر النتائج بعد رفع صورة.</p>}
        </div>
      </div>
    </section>
  );
}

function Thumb({ src, title }: { src?: string | null; title: string }) {
  return <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white text-slate-400 shadow-sm">{src ? <img src={src} alt={title} className="h-full w-full object-cover" loading="lazy" decoding="async" /> : getInitials(title).slice(0, 1)}</div>;
}

function buildMapNodes(wings: AnyRecord[], stores: AnyRecord[]): MapNode[] {
  const wingNodes = wings.slice(0, 9).map((wing, index) => ({ id: String(wing.id || wing.slug), type: "wing" as const, title: wing.name, subtitle: wing.description || "جناح تجاري", href: `/wings/${wing.slug}`, imageUrl: wing.heroImageUrl, x: 140 + (index % 3) * 190, y: 95 + Math.floor(index / 3) * 115, score: Number(wing.storeCount || wing.productCount || index + 1) }));
  const storeNodes = stores.slice(0, 8).map((store, index) => ({ id: String(store.id || store.slug), type: "store" as const, title: store.name, subtitle: "متجر داخل المول", href: `/store/${store.slug}`, imageUrl: store.logoUrl || store.coverImageUrl, x: 235 + (index % 4) * 145, y: 305 + Math.floor(index / 4) * 78, score: Number(store.orderCount || store.ratingAverage || index + 1) }));
  return [...wingNodes, ...storeNodes];
}

function rankProducts(products: AnyRecord[], interests: string[]) {
  const normalizedInterests = interests.map((item) => item.toLowerCase());
  return [...products].sort((a, b) => scoreProduct(b, normalizedInterests) - scoreProduct(a, normalizedInterests)).slice(0, 8);
}
function scoreProduct(product: AnyRecord, interests: string[]) {
  const text = `${product.name || ""} ${product.storeName || ""}`.toLowerCase();
  const interestScore = interests.reduce((sum, interest) => sum + (text.includes(interest) ? 15 : 0), 0);
  return Number(product.soldCount || 0) * 2 + Number(product.ratingAverage || 0) * 8 + interestScore;
}
function buildDiscoveryFeed({ stores, products, offers, wings }: { stores: AnyRecord[]; products: AnyRecord[]; offers: AnyRecord[]; wings: AnyRecord[] }) {
  return [
    ...products.slice(0, 8).map((product) => ({ kind: "product", id: product.id, title: product.name, subtitle: product.storeName || "منتج رائج", imageUrl: product.mainImageUrl, href: `/store/${product.storeSlug || "store"}/products/${product.slug}`, label: "منتج" })),
    ...stores.slice(0, 6).map((store) => ({ kind: "store", id: store.id, title: store.name, subtitle: "متجر داخل المول", imageUrl: store.coverImageUrl || store.logoUrl, href: `/store/${store.slug}`, label: "متجر" })),
    ...offers.slice(0, 6).map((offer) => ({ kind: "offer", id: offer.id, title: offer.title, subtitle: offer.storeName || "عرض معتمد", imageUrl: offer.imageUrl, href: offer.storeSlug ? `/store/${offer.storeSlug}?offer=${offer.id}` : "/offers", label: "عرض" })),
    ...wings.slice(0, 6).map((wing) => ({ kind: "wing", id: wing.id, title: wing.name, subtitle: wing.description || "جناح", imageUrl: wing.heroImageUrl, href: `/wings/${wing.slug}`, label: "جناح" }))
  ].slice(0, 20);
}
function fallbackImage(index: number) {
  return [
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=900&q=80"
  ][index % 4];
}
