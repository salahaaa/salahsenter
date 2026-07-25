export type BundleCandidateProduct = {
  productId: string;
  variantId: string | null;
  name: string;
  price: number;
  stockQuantity: number;
  categoryName?: string | null;
};

export type BundleSuggestionItem = BundleCandidateProduct & {
  quantity: number;
  originalLineTotal: number;
  suggestedUnitOfferPrice: number;
  suggestedLineTotal: number;
  matchReason: string;
};

export type BundleSuggestion = {
  title: string;
  description: string;
  items: BundleSuggestionItem[];
  originalTotal: number;
  suggestedBundlePrice: number;
  suggestedDiscountPercent: number;
  maxBundleQuantity: number;
  warnings: string[];
};

const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const numberWords: Record<string, number> = {
  واحد: 1,
  واحدة: 1,
  حبة: 1,
  حبه: 1,
  اثنين: 2,
  اثنان: 2,
  ثنين: 2,
  تنين: 2,
  قطعتين: 2,
  ثلاثة: 3,
  ثلاثه: 3,
  ثلاث: 3,
  اربع: 4,
  اربعة: 4,
  اربعه: 4,
  خمس: 5,
  خمسة: 5,
  خمسه: 5,
  ست: 6,
  ستة: 6,
  سته: 6,
  سبع: 7,
  سبعة: 7,
  سبعه: 7,
  ثمان: 8,
  ثمانية: 8,
  ثمانيه: 8,
  تسع: 9,
  تسعة: 9,
  تسعه: 9,
  عشر: 10,
  عشرة: 10,
  عشره: 10
};

const componentLexicon: Array<{ key: string; label: string; terms: string[]; defaultQty?: number }> = [
  { key: "rice", label: "أرز", terms: ["ارز", "أرز", "رز", "بسمتي", "مزة", "مزه"] },
  { key: "sugar", label: "سكر", terms: ["سكر"] },
  { key: "oil", label: "زيت", terms: ["زيت", "دبة زيت", "دبه زيت", "دبات زيت", "زيوت"] },
  { key: "plates", label: "صحون تقديم", terms: ["صحن", "صحون", "صحن تقديم", "صحون تقديم", "اطباق", "أطباق"] },
  { key: "flour", label: "طحين", terms: ["طحين", "دقيق"] },
  { key: "tea", label: "شاي", terms: ["شاي"] },
  { key: "dates", label: "تمر", terms: ["تمر", "تمور"] },
  { key: "milk", label: "حليب", terms: ["حليب", "لبن"] },
  { key: "water", label: "مياه", terms: ["مياه", "ماء", "موية", "مويه"] },
  { key: "cleaner", label: "منظف", terms: ["منظف", "تنظيف", "كلور", "صابون"] },
  { key: "shirt", label: "قميص", terms: ["قميص", "قمصان"] },
  { key: "pants", label: "بنطلون", terms: ["بنطلون", "جينز"] },
  { key: "shoe", label: "حذاء", terms: ["حذاء", "احذية", "أحذية", "شوز", "كوتشي"] }
];

export function normalizeArabic(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/ـ/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberFromText(value: string): number | null {
  const normalized = normalizeArabic(value);
  const numeric = normalized.match(/\d+/)?.[0];
  if (numeric) return Math.max(1, Number(numeric));
  const token = normalized.split(/\s+/).find((item) => numberWords[item] != null);
  return token ? numberWords[token] : null;
}

function quantityNearTerm(prompt: string, term: string) {
  const normalizedPrompt = normalizeArabic(prompt);
  const normalizedTerm = normalizeArabic(term);
  const index = normalizedPrompt.indexOf(normalizedTerm);
  if (index < 0) return null;
  const before = normalizedPrompt.slice(Math.max(0, index - 25), index);
  const after = normalizedPrompt.slice(index + normalizedTerm.length, index + normalizedTerm.length + 12);
  return numberFromText(before) || numberFromText(after);
}

function inferDiscount(prompt: string, explicit?: number | null) {
  if (explicit && explicit > 0 && explicit <= 80) return explicit;
  const normalized = normalizeArabic(prompt);
  const pct = normalized.match(/(\d{1,2})\s*%/)?.[1];
  if (pct) return Math.min(80, Math.max(1, Number(pct)));
  if (/رمضان|رمضاني|موسم|باقة|مجمع|تموين/.test(normalized)) return 10;
  if (/تصفيه|تصريف|تخفيض قوي|عرض قوي/.test(normalized)) return 18;
  return 12;
}

function roundPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1000) return Math.round(value / 100) * 100;
  if (value >= 100) return Math.round(value / 10) * 10;
  return Math.round(value);
}

function scoreProduct(product: BundleCandidateProduct, terms: string[]) {
  const haystack = normalizeArabic(`${product.name} ${product.categoryName || ""}`);
  let score = 0;
  for (const term of terms) {
    const normalized = normalizeArabic(term);
    if (!normalized) continue;
    if (haystack.includes(normalized)) score += normalized.length + 5;
  }
  score += Math.min(10, Math.max(0, product.stockQuantity) / 10);
  return score;
}

function bestProductForTerms(products: BundleCandidateProduct[], terms: string[], used: Set<string>) {
  return products
    .filter((product) => !used.has(product.productId) && product.stockQuantity > 0)
    .map((product) => ({ product, score: scoreProduct(product, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.product || null;
}

export function suggestBundleOffer(input: { prompt: string; products: BundleCandidateProduct[]; targetDiscountPercent?: number | null; maxItems?: number }): BundleSuggestion {
  const prompt = input.prompt || "";
  const normalizedPrompt = normalizeArabic(prompt);
  const products = input.products.filter((product) => product.price > 0 && product.variantId);
  const warnings: string[] = [];
  const used = new Set<string>();
  const items: BundleSuggestionItem[] = [];

  for (const component of componentLexicon) {
    if (!component.terms.some((term) => normalizedPrompt.includes(normalizeArabic(term)))) continue;
    const product = bestProductForTerms(products, component.terms, used);
    if (!product) {
      warnings.push(`لم أجد منتجاً مطابقاً لـ ${component.label} داخل متجرك.`);
      continue;
    }
    used.add(product.productId);
    const matchedTerm = component.terms.find((term) => normalizedPrompt.includes(normalizeArabic(term))) || component.terms[0];
    const quantity = quantityNearTerm(prompt, matchedTerm) || component.defaultQty || 1;
    items.push({
      ...product,
      quantity,
      originalLineTotal: product.price * quantity,
      suggestedUnitOfferPrice: product.price,
      suggestedLineTotal: product.price * quantity,
      matchReason: `مطابق لكلمة ${component.label}`
    });
  }

  if (!items.length) {
    const fallback = [...products]
      .sort((a, b) => b.stockQuantity - a.stockQuantity)
      .slice(0, Math.max(2, Math.min(input.maxItems || 3, 5)));
    for (const product of fallback) {
      items.push({
        ...product,
        quantity: 1,
        originalLineTotal: product.price,
        suggestedUnitOfferPrice: product.price,
        suggestedLineTotal: product.price,
        matchReason: "اختيار تلقائي من المنتجات المتوفرة"
      });
    }
    if (items.length) warnings.push("لم أحدد أصنافاً من النص بدقة، فاخترت منتجات متوفرة كاقتراح أولي.");
  }

  const originalTotal = items.reduce((sum, item) => sum + item.originalLineTotal, 0);
  const discount = inferDiscount(prompt, input.targetDiscountPercent);
  const suggestedBundlePrice = roundPrice(originalTotal * (1 - discount / 100));
  const ratio = originalTotal > 0 ? suggestedBundlePrice / originalTotal : 1;
  const adjustedItems = items.map((item) => ({
    ...item,
    suggestedUnitOfferPrice: roundPrice(item.price * ratio),
    suggestedLineTotal: roundPrice(item.price * ratio) * item.quantity
  }));
  const maxBundleQuantity = adjustedItems.length
    ? Math.max(0, Math.min(...adjustedItems.map((item) => Math.floor(item.stockQuantity / Math.max(1, item.quantity)))))
    : 0;

  if (!maxBundleQuantity) warnings.push("بعض المنتجات لا تملك مخزوناً كافياً لإنشاء باقات حالياً.");

  const title = /رمضان|رمضاني/.test(normalizedPrompt) ? "باقة رمضان الذكية" : /تموين|غذائي|غذائيه/.test(normalizedPrompt) ? "باقة تموين عائلية" : "عرض مجمع ذكي";
  const description = `اقتراح آلي مكوّن من ${adjustedItems.map((item) => `${item.quantity} × ${item.name}`).join(" + ")}. السعر قبل العرض ${roundPrice(originalTotal)}، والسعر المقترح ${suggestedBundlePrice}.`;

  return { title, description, items: adjustedItems, originalTotal: roundPrice(originalTotal), suggestedBundlePrice, suggestedDiscountPercent: discount, maxBundleQuantity, warnings };
}
