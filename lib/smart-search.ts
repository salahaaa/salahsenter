import { and, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import {
  categories,
  cities,
  countries,
  db,
  governorates,
  productVariants,
  products,
  stores,
  storeWings,
  users,
  wings
} from "@/lib/db";
import { hasDatabase } from "@/lib/db/queries";
import { defaultCurrencySettings } from "@/lib/currency-shared";
import { inlineMediaSql } from "@/lib/inline-media";

export type SmartSearchFilters = {
  minPriceBase?: number | null;
  maxPriceBase?: number | null;
  colors?: string[];
  gender?: string | null;
  style?: string | null;
  sort?: "relevance" | "price_asc" | "rating_desc" | "popular" | null;
};

export type SmartSearchIntent = {
  rawQuery: string;
  normalizedQuery: string;
  correctedQuery: string;
  tokens: string[];
  expandedTerms: string[];
  semanticLabels: string[];
  filters: SmartSearchFilters;
};

export type SmartProductResult = {
  id: string;
  type: "product";
  name: string;
  slug: string;
  href: string;
  imageUrl: string | null;
  price: string | null;
  storeName: string;
  storeSlug: string;
  categoryName: string | null;
  wingName: string | null;
  ratingAverage: string | number | null;
  soldCount: number | null;
  matchReason: string;
};

export type SmartStoreResult = {
  id: string;
  type: "store";
  name: string;
  slug: string;
  href: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  ratingAverage: string | number | null;
  orderCount: number | null;
  merchantName: string;
  wingName: string | null;
  location: string;
  matchReason: string;
};

export type SmartWingResult = {
  id: string;
  type: "wing";
  name: string;
  slug: string;
  href: string;
  imageUrl: string | null;
  description: string | null;
  storeCount: number;
  productCount: number;
  isNew: boolean;
  matchReason: string;
};

export type SmartCategoryResult = {
  id: string;
  type: "category";
  name: string;
  slug: string;
  href: string;
  imageUrl: string | null;
  storeName: string;
  storeSlug: string;
  productCount: number;
  matchReason: string;
};

export type SmartSearchResult = {
  query: string;
  correctedQuery: string;
  normalizedQuery: string;
  intent: SmartSearchIntent;
  suggestions: string[];
  products: SmartProductResult[];
  stores: SmartStoreResult[];
  wings: SmartWingResult[];
  categories: SmartCategoryResult[];
};

type SmartSearchOptions = {
  limit?: number;
  productLimit?: number;
  storeLimit?: number;
  wingLimit?: number;
  categoryLimit?: number;
  filters?: SmartSearchFilters;
};

const stopWords = new Set([
  "انا",
  "اني",
  "ابغي",
  "ابغى",
  "ابي",
  "اريد",
  "عايز",
  "عاوزه",
  "احتاج",
  "فين",
  "وين",
  "اين",
  "احسن",
  "افضل",
  "شراء",
  "اشتري",
  "اشتريه",
  "ممكن",
  "لو",
  "سمحت",
  "بس",
  "يكون",
  "تكون",
  "عرض",
  "اعرض",
  "لي",
  "من",
  "في",
  "على",
  "عن",
  "كل",
  "جميع",
  "داخل",
  "المول",
  "متوفر",
  "متوفره",
  "متاحة",
  "متاحه"
]);

const synonymGroups = [
  { canonical: "أحذية", labels: ["أحذية", "حذاء"], terms: ["حذاء", "حذا", "حذى", "احذية", "احذيه", "أحذية", "جزمة", "جزمه", "جزم", "كوتشي", "شوز", "سنيكرز", "نعال", "نعل"] },
  { canonical: "رياضي", labels: ["رياضي"], terms: ["رياضي", "رياضى", "سبورت", "sport", "sports", "كوتشي", "سنيكرز", "تمارين", "جيم"] },
  { canonical: "شاشات", labels: ["شاشات", "تلفزيونات"], terms: ["شاشة", "شاشه", "شاشات", "تلفزيون", "تلفاز", "سمارت", "tv", "4k", "ال اي دي", "LED", "led"] },
  { canonical: "هواتف", labels: ["هواتف", "جوالات"], terms: ["هاتف", "هواتف", "جوال", "جوالات", "موبايل", "موبایل", "موبيل", "تلفون", "ايفون", "آيفون"] },
  { canonical: "لابتوب", labels: ["كمبيوتر", "لابتوب"], terms: ["لابتوب", "لاب", "كمبيوتر", "حاسوب", "pc", "laptop", "ديسكتوب", "كمبيوترات"] },
  { canonical: "عطور", labels: ["عطور"], terms: ["عطر", "عطور", "برفان", "برفيوم", "perfume", "مسك", "بخور", "عود"] },
  { canonical: "ملابس", labels: ["ملابس", "أزياء"], terms: ["ملابس", "لبس", "ازياء", "أزياء", "ثياب", "قميص", "بنطلون", "تيشيرت", "فستان", "عباية", "جاكيت"] },
  { canonical: "رجالي", labels: ["رجالي"], terms: ["رجالي", "رجال", "رجالى", "للرجال", "شبابي", "شباب"] },
  { canonical: "نسائي", labels: ["نسائي"], terms: ["نسائي", "نسائى", "للنساء", "حريمي", "بناتي", "بنات"] },
  { canonical: "أطفال", labels: ["أطفال"], terms: ["اطفال", "أطفال", "طفل", "اولاد", "أولاد", "بنات", "Kids", "kids"] }
];

const colorSynonyms: Record<string, string[]> = {
  black: ["اسود", "أسود", "سوداء", "سوده", "سودا", "black"],
  white: ["ابيض", "أبيض", "بيضاء", "white"],
  red: ["احمر", "أحمر", "حمراء", "red"],
  blue: ["ازرق", "أزرق", "زرقاء", "blue"],
  green: ["اخضر", "أخضر", "green"],
  brown: ["بني", "بنى", "brown"],
  gray: ["رمادي", "رمادى", "رصاصي", "grey", "gray"],
  gold: ["ذهبي", "ذهبى", "gold"],
  silver: ["فضي", "فضى", "silver"]
};

const smartSuggestionSeeds = ["أحذية رياضية", "جوالات", "عطور فاخرة", "ملابس رجالية", "لابتوب", "عروض اليوم", "متاجر الإلكترونيات", "أحذية سوداء"];

function normalizeArabicText(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/ـ/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[^\p{L}\p{N}\s.#-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(query: string) {
  const normalized = normalizeArabicText(query);
  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function getSynonymGroup(token: string) {
  const normalizedToken = normalizeArabicText(token);
  return synonymGroups.find((group) => group.terms.some((term) => normalizeArabicText(term) === normalizedToken));
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function getColorFilters(query: string) {
  const normalized = normalizeArabicText(query);
  return Object.entries(colorSynonyms)
    .filter(([, aliases]) => aliases.some((alias) => normalized.includes(normalizeArabicText(alias))))
    .map(([color]) => color);
}

function colorTerms(colors: string[] = []) {
  return unique(colors.flatMap((color) => colorSynonyms[color] || [color]));
}

function parseSortPreference(query: string): SmartSearchFilters["sort"] {
  const normalized = normalizeArabicText(query);
  if (/ارخص|الرخيص|اقل سعر|اقل الاسعار|cheap|cheapest/.test(normalized)) return "price_asc";
  if (/اعلى تقييم|افضل تقييم|الاكثر تقييما|rating|top rated/.test(normalized)) return "rating_desc";
  if (/الاكثر مبيعا|الاشهر|الرائج|popular|best seller/.test(normalized)) return "popular";
  return null;
}

function parsePriceFilter(query: string): Pick<SmartSearchFilters, "minPriceBase" | "maxPriceBase"> {
  const normalized = normalizeArabicText(query);
  const maxMatch = normalized.match(/(?:اقل|تحت|دون|الى|حدود|below|under)\s*(?:من)?\s*(\d+(?:\.\d+)?)/i);
  const minMatch = normalized.match(/(?:اكثر|فوق|اعلى|above|over)\s*(?:من)?\s*(\d+(?:\.\d+)?)/i);
  const currencyCode = /دولار|usd|\$/.test(normalized) ? "USD" : /سعودي|ر\.س|sar/.test(normalized) ? "SAR" : "YER";
  const rate = defaultCurrencySettings.currencies.find((currency) => currency.code === currencyCode)?.rateToBase || 1;
  return {
    maxPriceBase: maxMatch ? Number(maxMatch[1]) * rate : null,
    minPriceBase: minMatch ? Number(minMatch[1]) * rate : null
  };
}

export function analyzeSmartQuery(rawQuery: string, extraFilters: SmartSearchFilters = {}): SmartSearchIntent {
  const raw = rawQuery.trim();
  const tokens = tokenize(raw);
  const rawTokens = raw
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !stopWords.has(normalizeArabicText(token)));
  const semanticGroups = tokens.map(getSynonymGroup).filter(Boolean) as Array<(typeof synonymGroups)[number]>;
  const semanticLabels = unique(semanticGroups.flatMap((group) => group.labels));
  const expandedFromSynonyms = semanticGroups.flatMap((group) => group.terms.concat(group.canonical));
  const colors = unique([...(extraFilters.colors || []), ...getColorFilters(raw)]);
  const terms = unique([...rawTokens, ...tokens, ...expandedFromSynonyms, ...colorTerms(colors)]).slice(0, 22);
  const correctedTokens = tokens.map((token) => getSynonymGroup(token)?.canonical || token);
  const priceFilters = parsePriceFilter(raw);

  return {
    rawQuery: raw,
    normalizedQuery: normalizeArabicText(raw),
    correctedQuery: unique(correctedTokens).join(" ") || raw,
    tokens,
    expandedTerms: terms,
    semanticLabels,
    filters: {
      ...priceFilters,
      ...extraFilters,
      minPriceBase: extraFilters.minPriceBase ?? priceFilters.minPriceBase,
      maxPriceBase: extraFilters.maxPriceBase ?? priceFilters.maxPriceBase,
      colors,
      sort: parseSortPreference(raw) || extraFilters.sort || "relevance"
    }
  };
}

function likeTerm(term: string) {
  return `%${term.replace(/[%_]/g, "\\$&")}%`;
}

function ilikeAny(expressions: SQL[], terms: string[]) {
  return terms.flatMap((term) => expressions.map((expression) => sql`${expression} ilike ${likeTerm(term)}`));
}

function scoreTexts(intent: SmartSearchIntent, values: Array<string | null | undefined>, popularity = 0) {
  const haystack = normalizeArabicText(values.filter(Boolean).join(" "));
  let score = popularity;
  for (const token of intent.tokens) {
    if (!token) continue;
    if (haystack === token) score += 60;
    else if (haystack.startsWith(token)) score += 35;
    else if (haystack.includes(token)) score += 20;
  }
  for (const term of intent.expandedTerms) {
    const normalizedTerm = normalizeArabicText(term);
    if (normalizedTerm && haystack.includes(normalizedTerm)) score += 8;
  }
  for (const label of intent.semanticLabels) {
    if (haystack.includes(normalizeArabicText(label))) score += 12;
  }
  return score;
}

function matchReason(intent: SmartSearchIntent, fallback: string) {
  if (intent.semanticLabels.length) return `مطابقة ذكية: ${intent.semanticLabels.slice(0, 3).join("، ")}`;
  if (intent.correctedQuery && intent.correctedQuery !== intent.rawQuery) return `تصحيح مقترح: ${intent.correctedQuery}`;
  return fallback;
}

function activeProductPriceExpression() {
  return sql<string | null>`coalesce(${products.basePrice}, (select min(${productVariants.price}) from ${productVariants} where ${productVariants.productId} = ${products.id} and ${productVariants.isActive} = true))`;
}

function productVariantTermExists(terms: string[]) {
  if (!terms.length) return sql`true`;
  return or(
    ...terms.flatMap((term) => [
      sql`exists (select 1 from product_variants pv where pv.product_id = ${products.id} and coalesce(pv.title, '') ilike ${likeTerm(term)})`,
      sql`exists (select 1 from product_variants pv where pv.product_id = ${products.id} and pv.attributes::text ilike ${likeTerm(term)})`
    ])
  ) || sql`true`;
}

export async function smartSearch(rawQuery = "", options: SmartSearchOptions = {}): Promise<SmartSearchResult> {
  const limit = Math.max(1, Math.min(options.limit || 8, 30));
  const productLimit = Math.max(1, Math.min(options.productLimit || limit, 40));
  const storeLimit = Math.max(1, Math.min(options.storeLimit || Math.min(limit, 10), 30));
  const wingLimit = Math.max(1, Math.min(options.wingLimit || Math.min(limit, 10), 30));
  const categoryLimit = Math.max(1, Math.min(options.categoryLimit || Math.min(limit, 10), 30));
  const intent = analyzeSmartQuery(rawQuery, options.filters || {});

  if (!hasDatabase()) {
    return {
      query: rawQuery,
      correctedQuery: intent.correctedQuery,
      normalizedQuery: intent.normalizedQuery,
      intent,
      suggestions: smartSuggestionSeeds,
      products: [],
      stores: [],
      wings: [],
      categories: []
    };
  }

  const terms = intent.expandedTerms.length ? intent.expandedTerms : intent.tokens;
  const hasQuery = terms.length > 0;
  const priceExpr = activeProductPriceExpression();
  const productConditions: SQL[] = [eq(products.status, "active"), eq(stores.status, "active"), eq(stores.isActive, true)];
  if (hasQuery) {
    productConditions.push(
      or(
        ...ilikeAny([
          sql`${products.name}`,
          sql`coalesce(${products.englishName}, '')`,
          sql`coalesce(${products.shortDescription}, '')`,
          sql`coalesce(${products.description}, '')`,
          sql`coalesce(${products.brand}, '')`,
          sql`coalesce(${categories.name}, '')`,
          sql`${stores.name}`,
          sql`coalesce(${wings.name}, '')`
        ], terms),
        productVariantTermExists(terms)
      ) || sql`true`
    );
  }
  if (intent.filters.maxPriceBase) productConditions.push(sql`${priceExpr}::numeric <= ${intent.filters.maxPriceBase}`);
  if (intent.filters.minPriceBase) productConditions.push(sql`${priceExpr}::numeric >= ${intent.filters.minPriceBase}`);
  if (intent.filters.colors?.length) {
    const termsForColors = colorTerms(intent.filters.colors);
    productConditions.push(
      or(
        ...ilikeAny([sql`${products.name}`, sql`coalesce(${products.description}, '')`, sql`coalesce(${products.shortDescription}, '')`], termsForColors),
        productVariantTermExists(termsForColors)
      ) || sql`true`
    );
  }

  const storeConditions: SQL[] = [eq(stores.status, "active"), eq(stores.isActive, true)];
  if (hasQuery) {
    storeConditions.push(
      or(
        ...ilikeAny([
          sql`${stores.name}`,
          sql`${stores.slug}`,
          sql`coalesce(${stores.description}, '')`,
          sql`${users.fullName}`,
          sql`coalesce(${wings.name}, '')`,
          sql`coalesce(${cities.name}, '')`,
          sql`coalesce(${governorates.name}, '')`
        ], terms)
      ) || sql`true`
    );
  }

  const wingConditions: SQL[] = [eq(wings.isActive, true)];
  if (hasQuery) {
    wingConditions.push(or(...ilikeAny([sql`${wings.name}`, sql`${wings.slug}`, sql`coalesce(${wings.description}, '')`], terms)) || sql`true`);
  }

  const categoryConditions: SQL[] = [eq(categories.isActive, true), eq(stores.status, "active"), eq(stores.isActive, true)];
  if (hasQuery) {
    categoryConditions.push(or(...ilikeAny([sql`${categories.name}`, sql`${categories.slug}`, sql`coalesce(${stores.name}, '')`], terms)) || sql`true`);
  }

  const [productRows, storeRows, wingRows, categoryRows] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        imageUrl: inlineMediaSql("products", products.id, "mainImageUrl", products.mainImageUrl),
        price: priceExpr,
        storeName: stores.name,
        storeSlug: stores.slug,
        categoryName: categories.name,
        wingName: wings.name,
        ratingAverage: products.ratingAverage,
        soldCount: products.soldCount,
        viewCount: products.viewCount,
        brand: products.brand,
        shortDescription: products.shortDescription
      })
      .from(products)
      .innerJoin(stores, eq(products.storeId, stores.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(wings, eq(stores.primaryWingId, wings.id))
      .where(and(...productConditions))
      .orderBy(desc(products.soldCount), desc(products.viewCount), desc(products.ratingAverage), desc(products.createdAt))
      .limit(productLimit * 3),
    db
      .select({
        id: stores.id,
        name: stores.name,
        slug: stores.slug,
        logoUrl: inlineMediaSql("stores", stores.id, "logoUrl", stores.logoUrl),
        coverImageUrl: inlineMediaSql("stores", stores.id, "coverImageUrl", stores.coverImageUrl),
        ratingAverage: stores.ratingAverage,
        orderCount: stores.orderCount,
        merchantName: users.fullName,
        wingName: wings.name,
        countryName: countries.name,
        governorateName: governorates.name,
        cityName: cities.name,
        description: stores.description
      })
      .from(stores)
      .innerJoin(users, eq(stores.merchantId, users.id))
      .leftJoin(wings, eq(stores.primaryWingId, wings.id))
      .leftJoin(countries, eq(stores.countryId, countries.id))
      .leftJoin(governorates, eq(stores.governorateId, governorates.id))
      .leftJoin(cities, eq(stores.cityId, cities.id))
      .where(and(...storeConditions))
      .orderBy(desc(stores.orderCount), desc(stores.ratingAverage), desc(stores.salesTotal), desc(stores.createdAt))
      .limit(storeLimit * 3),
    db
      .select({
        id: wings.id,
        name: wings.name,
        slug: wings.slug,
        imageUrl: sql<string | null>`coalesce(
          ${inlineMediaSql("wings", wings.id, "iconUrl", wings.iconUrl)},
          ${inlineMediaSql("wings", wings.id, "heroImageUrl", wings.heroImageUrl)},
          ${inlineMediaSql("wings", wings.id, "desktopImageUrl", wings.desktopImageUrl)},
          ${inlineMediaSql("wings", wings.id, "mobileImageUrl", wings.mobileImageUrl)}
        )`,
        description: wings.description,
        createdAt: wings.createdAt,
        storeCount: sql<number>`(
          select count(distinct search_wing_store_counts.id)::int
          from stores as search_wing_store_counts
          left join store_wings as search_wing_store_links on search_wing_store_links.store_id = search_wing_store_counts.id
          where search_wing_store_counts.status = 'active'
            and search_wing_store_counts.is_active = true
            and (search_wing_store_counts.primary_wing_id = "wings"."id" or search_wing_store_links.wing_id = "wings"."id")
        )`,
        productCount: sql<number>`(
          select count(distinct search_wing_product_counts.id)::int
          from products as search_wing_product_counts
          inner join stores as search_wing_product_stores on search_wing_product_counts.store_id = search_wing_product_stores.id
          left join store_wings as search_wing_product_store_links on search_wing_product_store_links.store_id = search_wing_product_stores.id
          where search_wing_product_counts.status = 'active'
            and search_wing_product_stores.status = 'active'
            and search_wing_product_stores.is_active = true
            and (search_wing_product_stores.primary_wing_id = "wings"."id" or search_wing_product_store_links.wing_id = "wings"."id")
        )`
      })
      .from(wings)
      .where(and(...wingConditions))
      .orderBy(desc(wings.createdAt), wings.sortOrder, wings.name)
      .limit(wingLimit * 3),
    db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        imageUrl: inlineMediaSql("categories", categories.id, "imageUrl", categories.imageUrl),
        storeName: stores.name,
        storeSlug: stores.slug,
        productCount: sql<number>`(
          select count(*)::int from ${products}
          where ${products.categoryId} = ${categories.id} and ${products.status} = 'active'
        )`
      })
      .from(categories)
      .innerJoin(stores, eq(categories.storeId, stores.id))
      .where(and(...categoryConditions))
      .orderBy(categories.sortOrder, categories.name)
      .limit(categoryLimit * 3)
  ]);

  const productsResult = productRows
    .map((product) => ({
      score: scoreTexts(intent, [product.name, product.brand, product.shortDescription, product.categoryName, product.storeName, product.wingName], Number(product.soldCount || 0) * 0.03 + Number(product.viewCount || 0) * 0.01),
      priceValue: Number(product.price || 0),
      ratingValue: Number(product.ratingAverage || 0),
      soldValue: Number(product.soldCount || 0),
      item: {
        id: product.id,
        type: "product" as const,
        name: product.name,
        slug: product.slug,
        href: `/store/${product.storeSlug}/products/${product.slug}`,
        imageUrl: product.imageUrl,
        price: product.price,
        storeName: product.storeName,
        storeSlug: product.storeSlug,
        categoryName: product.categoryName,
        wingName: product.wingName,
        ratingAverage: product.ratingAverage,
        soldCount: product.soldCount,
        matchReason: matchReason(intent, product.categoryName ? `ضمن تصنيف ${product.categoryName}` : "منتج مطابق")
      }
    }))
    .sort((a, b) => {
      if (intent.filters.sort === "price_asc") return a.priceValue - b.priceValue || b.score - a.score;
      if (intent.filters.sort === "rating_desc") return b.ratingValue - a.ratingValue || b.score - a.score;
      if (intent.filters.sort === "popular") return b.soldValue - a.soldValue || b.score - a.score;
      return b.score - a.score;
    })
    .slice(0, productLimit)
    .map((row) => row.item);

  const storesResult = storeRows
    .map((store) => ({
      score: scoreTexts(intent, [store.name, store.description, store.merchantName, store.wingName, store.cityName], Number(store.orderCount || 0) * 0.03 + Number(store.ratingAverage || 0)),
      item: {
        id: store.id,
        type: "store" as const,
        name: store.name,
        slug: store.slug,
        href: `/store/${store.slug}`,
        logoUrl: store.logoUrl,
        coverImageUrl: store.coverImageUrl,
        ratingAverage: store.ratingAverage,
        orderCount: store.orderCount,
        merchantName: store.merchantName,
        wingName: store.wingName,
        location: [store.cityName, store.governorateName, store.countryName].filter(Boolean).join("، "),
        matchReason: matchReason(intent, store.wingName ? `داخل ${store.wingName}` : "متجر مطابق")
      }
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, storeLimit)
    .map((row) => row.item);

  const wingsResult = wingRows
    .map((wing) => ({
      score: scoreTexts(intent, [wing.name, wing.description], Number(wing.storeCount || 0) * 0.2 + Number(wing.productCount || 0) * 0.05),
      item: {
        id: wing.id,
        type: "wing" as const,
        name: wing.name,
        slug: wing.slug,
        href: `/wings/${wing.slug}`,
        imageUrl: wing.imageUrl,
        description: wing.description,
        storeCount: Number(wing.storeCount || 0),
        productCount: Number(wing.productCount || 0),
        isNew: isRecent(wing.createdAt),
        matchReason: matchReason(intent, "جناح مطابق")
      }
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, wingLimit)
    .map((row) => row.item);

  const categoriesResult = categoryRows
    .map((category) => ({
      score: scoreTexts(intent, [category.name, category.storeName], Number(category.productCount || 0) * 0.1),
      item: {
        id: category.id,
        type: "category" as const,
        name: category.name,
        slug: category.slug,
        href: `/store/${category.storeSlug}?category=${category.slug}`,
        imageUrl: category.imageUrl,
        storeName: category.storeName,
        storeSlug: category.storeSlug,
        productCount: Number(category.productCount || 0),
        matchReason: matchReason(intent, `تصنيف داخل ${category.storeName}`)
      }
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, categoryLimit)
    .map((row) => row.item);

  return {
    query: rawQuery,
    correctedQuery: intent.correctedQuery,
    normalizedQuery: intent.normalizedQuery,
    intent,
    suggestions: buildSuggestions(intent, productsResult, storesResult, categoriesResult),
    products: productsResult,
    stores: storesResult,
    wings: wingsResult,
    categories: categoriesResult
  };
}

function buildSuggestions(intent: SmartSearchIntent, productsResult: SmartProductResult[], storesResult: SmartStoreResult[], categoriesResult: SmartCategoryResult[]) {
  const dynamic = unique([
    intent.correctedQuery,
    ...intent.semanticLabels,
    ...categoriesResult.map((category) => category.name),
    ...storesResult.slice(0, 2).map((store) => store.name),
    ...productsResult.slice(0, 3).map((product) => product.name)
  ]).filter(Boolean);
  return (dynamic.length ? dynamic : smartSuggestionSeeds).slice(0, 10);
}

export function mergeChatContext(message: string, previous?: { query?: string; filters?: SmartSearchFilters } | null) {
  const normalized = normalizeArabicText(message);
  const isFollowUp = /^(بس|فقط|طيب|تمام|خليها|خليه|يكون|تكون|اللون|لون|اقل|تحت|فوق|اعلى|بسعر)/.test(normalized) || /(اقل|تحت|فوق|اعلى|اسود|ابيض|احمر|ازرق|رياضي|رجالي|نسائي)/.test(normalized);
  const baseQuery = isFollowUp && previous?.query ? `${previous.query} ${message}` : message;
  const current = analyzeSmartQuery(baseQuery, previous?.filters || {});
  const direct = analyzeSmartQuery(message);
  return {
    query: baseQuery,
    filters: {
      ...current.filters,
      colors: unique([...(previous?.filters?.colors || []), ...(direct.filters.colors || []), ...(current.filters.colors || [])]),
      minPriceBase: direct.filters.minPriceBase ?? current.filters.minPriceBase ?? previous?.filters?.minPriceBase ?? null,
      maxPriceBase: direct.filters.maxPriceBase ?? current.filters.maxPriceBase ?? previous?.filters?.maxPriceBase ?? null,
      sort: direct.filters.sort && direct.filters.sort !== "relevance" ? direct.filters.sort : current.filters.sort || previous?.filters?.sort || "relevance"
    }
  };
}

function isRecent(value: Date | string | null, days = 14) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && Date.now() - time <= days * 24 * 60 * 60 * 1000;
}
