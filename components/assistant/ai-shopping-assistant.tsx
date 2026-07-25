"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, Image as ImageIcon, Loader2, Maximize2, MessageCircle, Minimize2, Send, ShoppingCart, Star, Store, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatNumber, getInitials } from "@/lib/utils";

type ProductCard = {
  id: string;
  name: string;
  href: string;
  imageUrl: string | null;
  price: string | null;
  storeName: string;
  wingName: string | null;
  ratingAverage: string | number | null;
};

type AssistantContext = {
  query?: string;
  filters?: {
    minPriceBase?: number | null;
    maxPriceBase?: number | null;
    colors?: string[];
    gender?: string | null;
    style?: string | null;
  };
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  products?: ProductCard[];
  suggestions?: string[];
  imagePreview?: string;
};

const initialSuggestions = ["أريد منتجاً بسعر مناسب", "اعرض المنتجات الأكثر طلباً", "ابحث عن منتج بوصفه", "اعرض العروض المتاحة"];
const hiddenPrefixes = ["/admin", "/merchant", "/login", "/forgot-password", "/reset-password"];

export function AIShoppingAssistant({ initialOpen = false, initialMode = "chat" }: { initialOpen?: boolean; initialMode?: "chat" | "visual" } = {}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(initialOpen);
  const [minimized, setMinimized] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<AssistantContext | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "مرحباً 👋 أنا مساعد التسوق الذكي في المول. اكتب اسم المنتج أو وصفه أو السعر المناسب لك، وسأقترح نتائج من المتاجر المتاحة.",
      suggestions: initialSuggestions
    }
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  const shouldHide = hiddenPrefixes.some((prefix) => pathname?.startsWith(prefix));

  useEffect(() => {
    if (!initialOpen) return;
    setOpen(true);
    setMinimized(false);
    if (initialMode === "visual") {
      setMessages((current) => current.some((item) => item.id === "visual-hint") ? current : [...current, { id: "visual-hint", role: "assistant", text: "ارفع صورة المنتج من زر الصورة أسفل المحادثة، وسأبحث لك عن منتجات مشابهة داخل المول." }]);
    }
  }, [initialMode, initialOpen]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open, minimized]);

  if (shouldHide) return null;

  async function send(value?: string) {
    const text = (value ?? message).trim();
    if (!text || loading) return;
    setMessage("");
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", text };
    setMessages((current) => [...current, userMessage]);
    setLoading(true);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, context })
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || "تعذر تشغيل المساعد");
      setContext(json.data.context);
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: json.data.answer,
        products: json.data.search.products,
        suggestions: json.data.suggestions
      };
      setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: error instanceof Error ? error.message : "حدث خطأ أثناء البحث. حاول مرة أخرى." }]);
    } finally {
      setLoading(false);
    }
  }

  async function visualSearch(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || loading) return;
    const preview = URL.createObjectURL(file);
    const query = file.name.replace(/[-_.]/g, " ").replace(/\.(png|jpe?g|webp|gif)$/i, "").trim() || "منتج مشابه";
    setOpen(true);
    setMinimized(false);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: `بحث بالصورة: ${file.name}`, imagePreview: preview }]);
    setLoading(true);
    try {
      const response = await fetch(`/api/search/advanced?q=${encodeURIComponent(query)}&limit=7&source=assistant_visual_search`);
      const json = await response.json();
      const products = response.ok && json.success ? json.data?.products || [] : [];
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        text: products.length ? "وجدت لك منتجات قد تكون مشابهة للصورة. يمكنك فتح المنتج أو إضافته للسلة." : "لم أجد نتائج واضحة من اسم الصورة حالياً. جرّب صورة باسم أوضح أو اكتب وصف المنتج بجانب الصورة.",
        products,
        suggestions: [query, "عروض مشابهة", "منتجات رائجة"]
      }]);
    } catch {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", text: "تعذر البحث بالصورة حالياً. جرّب كتابة وصف المنتج وسأبحث لك عنه." }]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    send();
  }

  return (
    <div className="fixed bottom-5 left-5 z-50 print:hidden">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="group flex items-center gap-3 rounded-full bg-slate-950 px-5 py-4 text-white shadow-2xl shadow-slate-900/25 transition hover:-translate-y-1">
          <span className="relative grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950"><Bot className="h-6 w-6" /><span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-slate-950" /></span>
          <span className="hidden text-right sm:block"><span className="block text-sm font-black">مساعد التسوق الذكي</span><span className="block text-xs text-white/55">اسألني عن أي منتج</span></span>
        </button>
      ) : (
        <div className={cn("w-[calc(100vw-2.5rem)] overflow-hidden rounded-[2rem] border bg-white shadow-2xl transition-all sm:w-[430px]", minimized ? "h-[86px]" : "h-[650px] max-h-[calc(100vh-2.5rem)]") }>
          <div className="relative overflow-hidden bg-slate-950 p-4 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(245,158,11,.25),transparent_28%),radial-gradient(circle_at_90%_15%,rgba(59,130,246,.25),transparent_30%)]" />
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-950"><MessageCircle className="h-6 w-6" /></span>
                <div>
                  <p className="font-black">AI Shopping Assistant</p>
                  <p className="text-xs text-white/60">بحث سياقي + اقتراحات ذكية</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <IconButton onClick={() => setMinimized((value) => !value)} label={minimized ? "تكبير" : "تصغير"}>{minimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}</IconButton>
                <IconButton onClick={() => setOpen(false)} label="إغلاق"><X className="h-4 w-4" /></IconButton>
              </div>
            </div>
          </div>

          {!minimized ? (
            <>
              <div className="h-[calc(100%-168px)] space-y-4 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-4">
                {messages.map((item) => <MessageBubble key={item.id} message={item} onSuggestion={send} />)}
                {loading ? <div className="flex justify-start"><div className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-500 shadow-sm"><Loader2 className="ml-2 inline h-4 w-4 animate-spin" /> جارٍ تحليل طلبك والبحث داخل المول...</div></div> : null}
                <div ref={endRef} />
              </div>
              <form onSubmit={submit} className="border-t bg-white p-3">
                <div className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-3 py-2 focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
                  <label className="relative grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-white text-blue-600 shadow-sm transition hover:bg-blue-50" title="بحث بالصورة">
                    <ImageIcon className="h-4 w-4" />
                    <input type="file" accept="image/*" onChange={visualSearch} className="absolute inset-0 cursor-pointer opacity-0" />
                  </label>
                  <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="اكتب اسم المنتج أو وصف ما تبحث عنه..." className="min-w-0 flex-1 bg-transparent text-right text-sm font-bold outline-none" />
                  <Button size="icon" disabled={loading || !message.trim()} className="rounded-xl"><Send className="h-4 w-4" /></Button>
                </div>
              </form>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message, onSuggestion }: { message: ChatMessage; onSuggestion: (value: string) => void }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[92%] rounded-[1.4rem] p-3 text-sm leading-7 shadow-sm", isUser ? "bg-gradient-to-l from-blue-600 to-indigo-600 text-white" : "bg-white text-slate-700")}>
        <p className="font-bold">{message.text}</p>
        {message.imagePreview ? <img src={message.imagePreview} alt="صورة البحث" className="mt-3 max-h-48 w-full rounded-2xl object-cover" /> : null}
        {message.products?.length ? <ProductCards products={message.products} /> : null}
        {message.suggestions?.length ? <div className="mt-3 flex flex-wrap justify-end gap-2">{message.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => onSuggestion(suggestion)} className="rounded-full border bg-slate-50 px-3 py-1 text-xs font-black text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">{suggestion}</button>)}</div> : null}
      </div>
    </div>
  );
}

function ProductCards({ products }: { products: ProductCard[] }) {
  return (
    <div className="mt-3 grid gap-3">
      {products.map((product) => <AssistantProductCard key={product.id} product={product} />)}
    </div>
  );
}

function AssistantProductCard({ product }: { product: ProductCard }) {
  const [added, setAdded] = useState(false);

  function addToLocalCart() {
    const item = { id: product.id, name: product.name, href: product.href, imageUrl: product.imageUrl, price: product.price, storeName: product.storeName, quantity: 1, addedAt: new Date().toISOString() };
    const current = JSON.parse(localStorage.getItem("salah_center_cart") || "[]") as Array<typeof item>;
    const exists = current.find((row) => row.id === item.id);
    const next = exists ? current.map((row) => row.id === item.id ? { ...row, quantity: row.quantity + 1 } : row) : [item, ...current];
    localStorage.setItem("salah_center_cart", JSON.stringify(next));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-slate-50 text-right">
      <div className="flex gap-3 p-3">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white text-slate-400 shadow-sm">
          {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" loading="lazy" /> : getInitials(product.name).slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 font-black text-slate-950">{product.name}</h4>
          <p className="mt-1 text-xs font-bold text-slate-500"><Store className="ml-1 inline h-3 w-3" /> {product.storeName}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="font-black text-primary">{product.price ? formatCurrency(product.price) : "حسب المتغير"}</span>
            <span className="text-xs font-bold text-amber-500"><Star className="ml-1 inline h-3 w-3 fill-current" /> {formatNumber(product.ratingAverage || 0)}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t bg-white p-2">
        <Button asChild size="sm" variant="outline"><Link href={product.href}>عرض المنتج</Link></Button>
        <Button type="button" size="sm" variant={added ? "secondary" : "default"} onClick={addToLocalCart}><ShoppingCart className="h-4 w-4" /> {added ? "تمت الإضافة" : "أضف للسلة"}</Button>
      </div>
    </div>
  );
}

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" aria-label={label} onClick={onClick} className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white transition hover:bg-white/20">{children}</button>;
}

export function AssistantScrollHint() {
  return <ChevronDown className="h-4 w-4 animate-bounce text-slate-400" />;
}
