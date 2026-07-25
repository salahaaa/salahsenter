import { and, eq, inArray } from "drizzle-orm";
import { categories, db, products, productSpecifications, productVariants, units, type Store } from "@/lib/db";
import { uniqueSlug } from "@/lib/slug";
import { generateProductCode } from "@/lib/product-coding";

export type DuplicateCandidate = {
  id: string;
  name: string;
  slug: string;
  barcode?: string | null;
  productCode?: string | null;
  mainImageUrl?: string | null;
  score: number;
  reason: string;
};

export type ProductDraftVariant = {
  title: string;
  sku?: string;
  barcode?: string;
  unitId?: string | null;
  price?: number;
  stockQuantity?: number;
  lowStockThreshold?: number;
  imageUrl?: string;
  images?: string[];
  attributes: Record<string, string>;
};

export type ProductDraft = {
  name: string;
  categoryId?: string | null;
  categoryName?: string;
  brand?: string;
  barcode?: string;
  basePrice?: number;
  stockQuantity?: number;
  lowStockThreshold?: number;
  mainImageUrl?: string;
  shortDescription?: string;
  description?: string;
  keywords?: string[];
  tags?: string[];
  attributes?: Record<string, string>;
  variants?: ProductDraftVariant[];
  confidenceScore?: number;
  classificationMode?: "auto" | "suggested" | "needs_review";
  duplicateCandidates?: DuplicateCandidate[];
  status?: "draft" | "review" | "active" | "paused" | "inactive" | "archived";
  /** Explicit customer journey; never inferred from a sector or price. */
  productCommerceType?: "ONLINE_SALES" | "SHOWCASE_ONLY";
};

type CategoryOption = { id: string; name: string; slug?: string | null };

const knownBrands = [
  "samsung", "سامسونج", "apple", "ابل", "آبل", "iphone", "xiaomi", "شاومي", "huawei", "هواوي", "lg", "sony", "سوني", "nike", "نايك", "adidas", "اديداس", "puma", "بوما", "zara", "زارا"
];

const categorySignals: Array<{ category: string; terms: string[]; tags: string[] }> = [
  { category: "إلكترونيات", terms: ["شاشة", "تلفزيون", "سمارت", "جوال", "هاتف", "لابتوب", "كمبيوتر", "سماعة", "كاميرا", "4k"], tags: ["إلكترونيات", "تقنية"] },
  { category: "أثاث وغرف نوم", terms: ["غرفة نوم", "غرفه نوم", "سرير", "دولاب", "كبت", "تسريحة", "كومدينة", "اثاث", "أثاث", "ماليزي", "تركي"], tags: ["أثاث", "غرف نوم"] },
  { category: "أزياء", terms: ["قميص", "فستان", "حذاء", "جزمة", "شوز", "بنطلون", "جاكيت", "ملابس"], tags: ["أزياء", "موضة"] },
  { category: "أدوات منزلية", terms: ["قدر", "مقلاة", "طقم", "مطبخ", "منزلي", "منزلية", "مكنسة", "خلاط"], tags: ["منزل", "مطبخ"] },
  { category: "عطور", terms: ["عطر", "عطور", "برفان", "مسك", "عود", "بخور"], tags: ["عطور"] },
  { category: "مواد البناء", terms: ["اسمنت", "حديد", "دهان", "بلاط", "مواسير", "كهرباء", "سباكة"], tags: ["بناء"] }
];

const colorAliases: Array<{ canonical: string; terms: string[] }> = [
  { canonical: "أبيض", terms: ["ابيض", "أبيض", "white"] },
  { canonical: "أسود", terms: ["اسود", "أسود", "black"] },
  { canonical: "وردي", terms: ["وردي", "وردى", "وردي", "ورد", "pink"] },
  { canonical: "رمادي", terms: ["رمادي", "رمادى", "رصاصي", "رصاصى", "مادي", "gray", "grey"] },
  { canonical: "بيج", terms: ["بيج", "beige"] },
  { canonical: "بني", terms: ["بني", "بنى", "brown"] },
  { canonical: "ذهبي", terms: ["ذهبي", "ذهبى", "gold", "golden"] },
  { canonical: "فضي", terms: ["فضي", "فضى", "silver"] },
  { canonical: "أحمر", terms: ["احمر", "أحمر", "red"] },
  { canonical: "أزرق", terms: ["ازرق", "أزرق", "blue"] },
  { canonical: "أخضر", terms: ["اخضر", "أخضر", "green"] }
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}\s×x*\.]/gu, " ").replace(/\s+/g, " ").trim();
}

function tokens(value: string) {
  return normalize(value).split(" ").filter((token) => token.length > 1);
}

function jaccardSimilarity(a: string, b: string) {
  const aTokens = new Set(tokens(a));
  const bTokens = new Set(tokens(b));
  if (!aTokens.size || !bTokens.size) return 0;
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return Math.round((intersection / union) * 100);
}

function extractBrand(text: string) {
  const normalized = normalize(text);
  return knownBrands.find((brand) => normalized.includes(normalize(brand))) || undefined;
}

function extractSizes(text: string) {
  const found = new Set<string>();
  const normalized = normalize(text).replace(/(\d)\s*[x×*]\s*(\d)/g, "$1×$2");
  for (const match of normalized.matchAll(/(\d{2,3}(?:\.\d+)?)\s*[x×*]\s*(\d{2,3}(?:\.\d+)?)/g)) {
    found.add(`${match[1]}×${match[2]}`);
  }
  for (const match of normalized.matchAll(/(?:مقاس|size)\s*([a-z0-9\-\/]+)\b/gi)) {
    const value = match[1];
    if (!/^\d{2,3}$/.test(value)) found.add(value.toUpperCase());
  }
  // Voice transcription often says: "مقاسات M و L و XL". Capture the list
  // until a pricing/stock/color marker and preserve every conventional size.
  const sizeList = normalized.match(/(?:مقاس|مقاسات|size)\s*([^،,.;]*?)(?=(?:بسعر|سعر|مخزون|كميه|كمية|لون|الالوان|الألوان|$))/i)?.[1] || "";
  for (const value of sizeList.match(/\b(?:xxs|xs|s|m|l|xl|xxl|xxxl|\d{2,3})\b/gi) || []) {
    found.add(value.toUpperCase());
  }
  const inch = normalized.match(/(\d{2,3})\s*(?:بوصه|انش|inch|inches)/i);
  if (inch) found.add(`${inch[1]} بوصة`);
  return [...found];
}

function extractSize(text: string) {
  return extractSizes(text)[0];
}

function extractColors(text: string) {
  const normalized = normalize(text).replace(/وردمادي|وردمادى|وردي\s*رمادي|وردي\s*رمادى/g, "وردي رمادي");
  const found = new Set<string>();
  for (const color of colorAliases) {
    if (color.terms.some((term) => normalized.includes(normalize(term)))) found.add(color.canonical);
  }
  return [...found];
}

function extractColor(text: string) {
  return extractColors(text)[0];
}

function extractPrice(text: string) {
  const normalized = normalize(text);
  const explicit = normalized.match(/(?:بسعر|سعر|price)\s*(\d+(?:\.\d+)?)/i) || normalized.match(/(\d+(?:\.\d+)?)\s*(?:ريال|ر\.ي|sar|usd|دولار)/i);
  if (!explicit) return undefined;
  const value = Number(explicit[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function extractStock(text: string) {
  const match = normalize(text).match(/(?:مخزون|كميه|كمية|stock|qty)\s*(\d+)/i);
  const value = match ? Number(match[1]) : undefined;
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function findSuggestedCategory(text: string, categories: CategoryOption[]) {
  const normalized = normalize(text);
  const signal = categorySignals.find((entry) => entry.terms.some((term) => normalized.includes(normalize(term))));
  if (!signal) return null;
  const existing = categories.find((category) => normalize(category.name).includes(normalize(signal.category)) || normalize(signal.category).includes(normalize(category.name)) || signal.terms.some((term) => normalize(category.name).includes(normalize(term))));
  return { signal, category: existing || null };
}

function inferProductName(text: string) {
  const normalizedOriginal = text.trim().replace(/\s+/g, " ");
  const beforeOptions = normalizedOriginal.split(/(?:مقاس|المقاس|مقاسات|الألوان|الالوان|والألوان|والالوان|سعر|بسعر|مخزون|كمية|كميه)/i)[0]?.trim();
  const base = beforeOptions || normalizedOriginal;
  return base.replace(/[،,؛:]+$/g, "").trim() || normalizedOriginal || "منتج جديد";
}

function inferOrigin(text: string) {
  const normalized = normalize(text);
  if (normalized.includes("ماليزي") || normalized.includes("ماليزيا")) return "ماليزيا";
  if (normalized.includes("تركي") || normalized.includes("تركيا")) return "تركيا";
  if (normalized.includes("صيني") || normalized.includes("الصين")) return "الصين";
  return undefined;
}

function buildDraftDescription(params: { name: string; brand?: string; sizes: string[]; colors: string[]; origin?: string; category?: string; text: string }) {
  const details = [
    params.origin ? `منشأ/طراز ${params.origin}` : null,
    params.brand ? `من ${params.brand}` : null,
    params.sizes.length ? `متوفر بالمقاسات: ${params.sizes.join("، ")}` : null,
    params.colors.length ? `متوفر بالألوان: ${params.colors.join("، ")}` : null
  ].filter(Boolean);
  return [
    `${params.name} ${params.category ? `ضمن ${params.category}` : ""}.`.trim(),
    details.length ? details.join("، ") + "." : "منتج متاح ضمن تشكيلة المتجر ويمكن تخصيص وصفه من لوحة التاجر.",
    "يمكن للعميل اختيار المواصفات المناسبة عند توفر أكثر من خيار."
  ].join("\n");
}

export function buildVariantsFromOptions(options: { sizes?: string[]; colors?: string[]; basePrice?: number; stockQuantity?: number; lowStockThreshold?: number; imageUrl?: string; barcode?: string; productName?: string }) {
  const sizes = [...new Set((options.sizes || []).map((item) => item.trim()).filter(Boolean))];
  const colors = [...new Set((options.colors || []).map((item) => item.trim()).filter(Boolean))];
  const sizeOptions = sizes.length ? sizes : [""];
  const colorOptions = colors.length ? colors : [""];
  const variants: ProductDraftVariant[] = [];

  for (const size of sizeOptions) {
    for (const color of colorOptions) {
      const attributes: Record<string, string> = {};
      if (size) attributes["المقاس"] = size;
      if (color) attributes["اللون"] = color;
      const title = [size, color].filter(Boolean).join(" / ") || "افتراضي";
      variants.push({
        title,
        sku: uniqueSlug(`${options.productName || "product"}-${title}`).toUpperCase().slice(0, 80),
        barcode: variants.length === 0 ? options.barcode : undefined,
        price: options.basePrice || 0,
        stockQuantity: options.stockQuantity ?? 1,
        lowStockThreshold: options.lowStockThreshold ?? 2,
        imageUrl: options.imageUrl,
        images: options.imageUrl ? [options.imageUrl] : [],
        attributes
      });
    }
  }

  return variants.slice(0, 80);
}

export function parseProductTextToDraft(text: string, categories: CategoryOption[] = []): ProductDraft {
  const clean = text.trim();
  const brand = extractBrand(clean);
  const sizes = extractSizes(clean);
  const colors = extractColors(clean);
  const size = sizes[0];
  const color = colors[0];
  const price = extractPrice(clean);
  const stock = extractStock(clean);
  const origin = inferOrigin(clean);
  const categoryMatch = findSuggestedCategory(clean, categories);
  const name = inferProductName(clean);
  const attributes: Record<string, string> = {};
  if (size) attributes["المقاس"] = size;
  if (sizes.length > 1) attributes["المقاسات المتاحة"] = sizes.join("، ");
  if (color) attributes["اللون"] = color;
  if (colors.length > 1) attributes["الألوان المتاحة"] = colors.join("، ");
  if (brand) attributes["العلامة التجارية"] = brand;
  if (origin) attributes["بلد المنشأ"] = origin;

  const keywords = [brand, origin, ...sizes, ...colors, categoryMatch?.signal.category, ...clean.split(" ").filter((word) => word.length > 2)].filter(Boolean) as string[];
  const uniqueKeywords = [...new Set(keywords)].slice(0, 12);
  const confidenceScore = Math.min(98, 35 + (categoryMatch ? 20 : 0) + (brand ? 12 : 0) + (sizes.length ? 12 : 0) + (colors.length ? 12 : 0) + (price ? 7 : 0) + (origin ? 5 : 0) + (clean.length > 12 ? 5 : 0));
  const classificationMode = confidenceScore >= 75 ? "auto" : confidenceScore >= 50 ? "suggested" : "needs_review";
  const defaultStock = stock ?? 1;
  const description = buildDraftDescription({ name, brand, sizes, colors, origin, category: categoryMatch?.category?.name || categoryMatch?.signal.category, text: clean });

  return {
    name,
    categoryId: categoryMatch?.category?.id || null,
    categoryName: categoryMatch?.category?.name || categoryMatch?.signal.category,
    brand,
    basePrice: price,
    stockQuantity: defaultStock,
    lowStockThreshold: 2,
    shortDescription: `${name}${sizes.length ? ` — مقاسات ${sizes.join("، ")}` : ""}${colors.length ? ` — ألوان ${colors.join("، ")}` : ""}.`,
    description,
    keywords: uniqueKeywords,
    tags: [...new Set([...(categoryMatch?.signal.tags || []), brand, origin, ...colors, ...sizes].filter(Boolean) as string[])].slice(0, 10),
    attributes,
    variants: buildVariantsFromOptions({ sizes, colors, basePrice: price, stockQuantity: defaultStock, lowStockThreshold: 2, productName: name }),
    confidenceScore,
    classificationMode,
    status: "draft"
  };
}

export async function getStoreCategories(storeId: string) {
  return db.select({ id: categories.id, name: categories.name, slug: categories.slug }).from(categories).where(eq(categories.storeId, storeId));
}

export async function detectDuplicateProducts(storeId: string, draft: ProductDraft): Promise<DuplicateCandidate[]> {
  const productRows = await db
    .select({ id: products.id, name: products.name, slug: products.slug, barcode: products.barcode, productCode: products.productCode, mainImageUrl: products.mainImageUrl })
    .from(products)
    .where(eq(products.storeId, storeId))
    .limit(1500);

  const productIds = productRows.map((product) => product.id);
  const variantRows = productIds.length
    ? await db
        .select({ productId: productVariants.productId, sku: productVariants.sku, barcode: productVariants.barcode, title: productVariants.title })
        .from(productVariants)
        .where(inArray(productVariants.productId, productIds))
    : [];
  const variantsByProduct = new Map<string, typeof variantRows>();
  for (const variant of variantRows) variantsByProduct.set(variant.productId, [...(variantsByProduct.get(variant.productId) || []), variant]);

  return productRows
    .map((product) => {
      const variants = variantsByProduct.get(product.id) || [];
      let score = jaccardSimilarity(draft.name, product.name);
      let reason = "تشابه في الاسم";
      if (draft.barcode && (product.barcode === draft.barcode || variants.some((variant) => variant.barcode === draft.barcode))) {
        score = 100;
        reason = "نفس الباركود";
      } else if (variants.some((variant) => draft.barcode && variant.sku === draft.barcode)) {
        score = 96;
        reason = "الباركود يطابق SKU";
      } else if (draft.brand && normalize(product.name).includes(normalize(draft.brand))) {
        score = Math.max(score, 70);
        reason = "تشابه في الاسم والعلامة التجارية";
      }
      return { ...product, score, reason };
    })
    .filter((candidate) => candidate.score >= 60)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export async function enrichProductDraft(storeId: string, draft: ProductDraft) {
  const duplicateCandidates = await detectDuplicateProducts(storeId, draft);
  return { ...draft, duplicateCandidates };
}

export async function createProductFromDraft(store: Store, draft: ProductDraft, actorId: string, mode: "create" | "update" = "create") {
  if (!draft.categoryId) {
    throw new Error("يجب اختيار قسم/مجموعة للمنتج قبل الحفظ.");
  }
  if (draft.status === "active" && Number(draft.basePrice || 0) <= 0 && !(draft.variants || []).some((variant) => Number(variant.price || 0) > 0)) {
    throw new Error("لا يمكن نشر منتج بدون سعر أكبر من صفر. احفظه كمسودة أولاً.");
  }
  const slug = uniqueSlug(draft.name);
  const [existingByBarcode] = draft.barcode
    ? await db.select().from(products).where(eq(products.barcode, draft.barcode)).limit(1)
    : [];
  const duplicateTargetId = draft.duplicateCandidates?.[0]?.id;
  const [existingByDuplicate] = mode === "update" && duplicateTargetId
    ? await db.select().from(products).where(and(eq(products.id, duplicateTargetId), eq(products.storeId, store.id))).limit(1)
    : [];
  const updateTarget = existingByBarcode?.storeId === store.id ? existingByBarcode : existingByDuplicate;

  if (mode === "update" && updateTarget && updateTarget.storeId === store.id) {
    const [updated] = await db.update(products).set({
      name: draft.name,
      categoryId: draft.categoryId || updateTarget.categoryId,
      brand: draft.brand || updateTarget.brand,
      shortDescription: draft.shortDescription,
      description: draft.description,
      basePrice: draft.basePrice?.toString() || updateTarget.basePrice,
      mainImageUrl: draft.mainImageUrl || updateTarget.mainImageUrl,
      specifications: draft.attributes || updateTarget.specifications,
      type: draft.variants && draft.variants.length > 1 ? "variable" : updateTarget.type,
      status: draft.status || updateTarget.status,
      productCommerceType: draft.productCommerceType || updateTarget.productCommerceType,
      updatedAt: new Date()
    }).where(eq(products.id, updateTarget.id)).returning();
    return { product: updated, action: "updated" as const };
  }

  const cleanVariants = draft.variants?.length
    ? draft.variants
    : buildVariantsFromOptions({
        sizes: draft.attributes?.["المقاسات المتاحة"]?.split(/،|,/) || (draft.attributes?.["المقاس"] ? [draft.attributes["المقاس"]] : []),
        colors: draft.attributes?.["الألوان المتاحة"]?.split(/،|,/) || (draft.attributes?.["اللون"] ? [draft.attributes["اللون"]] : []),
        basePrice: draft.basePrice,
        stockQuantity: draft.stockQuantity ?? 1,
        lowStockThreshold: draft.lowStockThreshold ?? 2,
        imageUrl: draft.mainImageUrl,
        barcode: draft.barcode,
        productName: draft.name
      });

  const [defaultUnit] = await db.select({ id: units.id }).from(units).where(and(eq(units.storeId, store.id), eq(units.isActive, true))).limit(1);
  if (!defaultUnit) throw new Error("يجب إضافة وحدة بيع واحدة على الأقل قبل حفظ المنتج.");
  const productCode = await generateProductCode(db, store.id, draft.categoryId || null);
  const [product] = await db.insert(products).values({
    storeId: store.id,
    categoryId: draft.categoryId || null,
    name: draft.name,
    englishName: undefined,
    slug,
    productCode,
    codeMode: "auto",
    barcode: draft.barcode || undefined,
    shortDescription: draft.shortDescription,
    description: draft.description,
    brand: draft.brand,
    originCountry: draft.attributes?.["بلد المنشأ"],
    type: cleanVariants.length > 1 ? "variable" : "simple",
    status: draft.status || "draft",
    basePrice: draft.basePrice?.toString() || "0",
    mainImageUrl: draft.mainImageUrl || null,
    images: draft.mainImageUrl ? [draft.mainImageUrl] : [],
    specifications: draft.attributes || {},
    pricingMode: "independent",
    inventoryMode: "variant",
    productCommerceType: draft.productCommerceType || "ONLINE_SALES",
    discountPercent: "0"
  }).returning();

  const specRows = Object.entries(draft.attributes || {}).map(([name, value], index) => ({ productId: product.id, name, value, sortOrder: index }));
  if (specRows.length) await db.insert(productSpecifications).values(specRows);

  await db.insert(productVariants).values(
    cleanVariants.map((variant, index) => ({
      productId: product.id,
      sku: variant.sku || `${product.slug}-${index + 1}`,
      barcode: index === 0 ? (variant.barcode || draft.barcode || undefined) : variant.barcode || undefined,
      title: variant.title || Object.values(variant.attributes || {}).join(" / ") || "افتراضي",
      unitId: variant.unitId || defaultUnit.id,
      price: (variant.price ?? draft.basePrice ?? 0).toString(),
      stockQuantity: variant.stockQuantity ?? draft.stockQuantity ?? 1,
      lowStockThreshold: variant.lowStockThreshold ?? draft.lowStockThreshold ?? 2,
      imageUrl: variant.imageUrl || draft.mainImageUrl || null,
      images: variant.images?.length ? variant.images : draft.mainImageUrl ? [draft.mainImageUrl] : [],
      attributes: variant.attributes || draft.attributes || {}
    }))
  ).onConflictDoNothing();

  return { product, action: "created" as const };
}
