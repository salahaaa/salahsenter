import { and, eq, sql } from "drizzle-orm";
import {
  categories,
  db,
  productAttributeValues,
  productAttributes,
  products,
  productVariants,
  storeMedia,
  stores,
  systemSettings,
  type Store
} from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { slugify, uniqueSlug } from "@/lib/slug";

export type StoreStyle = "modern" | "luxury" | "dark" | "soft" | "youth" | "classic";
export type StoreSetupInput = {
  activity: string;
  storeName: string;
  style: StoreStyle;
  description?: string;
  primaryColor?: string;
  accentColor?: string;
  includeCategories?: boolean;
  includeProducts?: boolean;
  includeBanners?: boolean;
  includeAttributes?: boolean;
};

export type StoreSetupPlan = {
  version: 1;
  generatedAt: string;
  input: StoreSetupInput;
  theme: {
    name: string;
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    textColor: string;
    fontFamily: string;
    mood: string;
  };
  layout: Array<{ id: string; title: string; type: "hero" | "banner" | "categories" | "featured_products" | "contact"; visible: boolean; sortOrder: number }>;
  banners: Array<{ title: string; subtitle: string; imageUrl: string; ctaText: string; ctaUrl: string }>;
  categories: Array<{ name: string; description: string; icon: string; slug: string }>;
  attributes: Array<{ name: string; code: string; displayType: string; values: Array<{ value: string; code?: string; colorHex?: string }> }>;
  demoProducts: Array<{ name: string; description: string; categorySlug: string; price: number; stock: number; imageUrl: string; attributes: Record<string, string> }>;
  instructions: string[];
};

const palettes: Record<StoreStyle, { primary: string; accent: string; background: string; text: string; mood: string }> = {
  modern: { primary: "#2563eb", accent: "#06b6d4", background: "#f8fafc", text: "#0f172a", mood: "حديث ونظيف" },
  luxury: { primary: "#111827", accent: "#d97706", background: "#fff7ed", text: "#111827", mood: "فاخر وهادئ" },
  dark: { primary: "#020617", accent: "#38bdf8", background: "#0f172a", text: "#f8fafc", mood: "داكن واحترافي" },
  soft: { primary: "#7c3aed", accent: "#f0abfc", background: "#faf5ff", text: "#1e1b4b", mood: "هادئ وناعم" },
  youth: { primary: "#e11d48", accent: "#f59e0b", background: "#fff1f2", text: "#111827", mood: "شبابي وحيوي" },
  classic: { primary: "#334155", accent: "#0f766e", background: "#f8fafc", text: "#0f172a", mood: "كلاسيكي موثوق" }
};

const activityTemplates: Array<{ key: string; match: string[]; categories: string[]; products: string[]; attributes: StoreSetupPlan["attributes"] }> = [
  {
    key: "restaurant",
    match: ["مطعم", "مطاعم", "وجبه", "وجبة", "اكل", "أكل", "طعام", "مأكولات", "ماكولات", "مشويات", "برجر", "بيتزا", "كافتيريا", "مقهى", "قهوه", "قهوة", "شاورما", "مندي", "مطبخ"],
    categories: ["الوجبات الرئيسية", "السندويتشات", "المشويات", "المشروبات", "الحلويات"],
    products: ["وجبة عائلية", "ساندويتش خاص", "طبق مشويات", "عصير طازج"],
    attributes: [
      { name: "الحجم", code: "meal_size", displayType: "button", values: [{ value: "صغير", code: "S" }, { value: "وسط", code: "M" }, { value: "كبير", code: "L" }] },
      { name: "الإضافات", code: "addons", displayType: "button", values: [{ value: "بدون إضافات" }, { value: "جبن إضافي" }, { value: "صلصة خاصة" }, { value: "بطاطس" }] },
      { name: "درجة الحار", code: "spice", displayType: "button", values: [{ value: "عادي" }, { value: "حار" }, { value: "حار جداً" }] }
    ]
  },
  {
    key: "grocery",
    match: ["سوبر", "سوبرماركت", "بقاله", "بقالة", "تموين", "مواد غذائيه", "مواد غذائية", "خضار", "خضروات", "فواكه", "فاكهة", "دكاني", "دكان"],
    categories: ["الخضار والفواكه", "المواد الغذائية", "المشروبات", "منتجات الألبان", "العروض اليومية"],
    products: ["سلة خضار طازجة", "سلة فواكه موسمية", "عرض تموين منزلي", "مشروب بارد"],
    attributes: [
      { name: "الوزن", code: "weight", displayType: "button", values: [{ value: "500 جرام" }, { value: "1 كيلو" }, { value: "5 كيلو" }] },
      { name: "الحالة", code: "freshness", displayType: "button", values: [{ value: "طازج" }, { value: "مبرد" }, { value: "مجمد" }] }
    ]
  },
  {
    key: "electronics",
    match: ["الكترون", "إلكترون", "جوال", "هاتف", "شاشة", "كمبيوتر", "لابتوب"],
    categories: ["الشاشات", "الجوالات", "اللابتوبات", "الإكسسوارات"],
    products: ["شاشة سمارت 4K", "سماعة بلوتوث", "شاحن سريع", "حامل جوال"],
    attributes: [
      { name: "اللون", code: "color", displayType: "color", values: [{ value: "أسود", code: "BLACK", colorHex: "#111827" }, { value: "أبيض", code: "WHITE", colorHex: "#ffffff" }] },
      { name: "المقاس", code: "size", displayType: "button", values: [{ value: "40 بوصة", code: "40" }, { value: "60 بوصة", code: "60" }] }
    ]
  },
  {
    key: "fashion",
    match: ["ملابس", "ازياء", "أزياء", "موضة", "حذاء", "نسائي", "رجالي"],
    categories: ["فساتين", "أحذية", "حقائب", "إكسسوارات"],
    products: ["حذاء رياضي", "حقيبة فاخرة", "قميص قطني", "فستان أنيق"],
    attributes: [
      { name: "اللون", code: "color", displayType: "color", values: [{ value: "أسود", code: "BLACK", colorHex: "#111827" }, { value: "بيج", code: "BEIGE", colorHex: "#d6c2a6" }, { value: "وردي", code: "PINK", colorHex: "#f9a8d4" }] },
      { name: "المقاس", code: "size", displayType: "button", values: [{ value: "S" }, { value: "M" }, { value: "L" }, { value: "XL" }] }
    ]
  },
  {
    key: "home",
    match: ["منزل", "منزلي", "ادوات", "أدوات", "اواني"],
    categories: ["أدوات المطبخ", "تنظيم المنزل", "أجهزة صغيرة", "ديكور"],
    products: ["طقم أواني", "خلاط كهربائي", "منظم مطبخ", "مكنسة يدوية"],
    attributes: [
      { name: "اللون", code: "color", displayType: "color", values: [{ value: "فضي", code: "SILVER", colorHex: "#cbd5e1" }, { value: "أسود", code: "BLACK", colorHex: "#111827" }] },
      { name: "السعة", code: "capacity", displayType: "button", values: [{ value: "1 لتر" }, { value: "2 لتر" }, { value: "5 لتر" }] }
    ]
  },
  {
    key: "general",
    match: ["متجر", "محل", "تجاره", "تجارة", "تسوق", "عام", "متنوع"],
    categories: ["الأكثر طلباً", "العروض", "وصل حديثاً", "منتجات مختارة"],
    products: ["منتج مميز", "عرض خاص", "منتج جديد", "باقة مختارة"],
    attributes: [
      { name: "النوع", code: "type", displayType: "button", values: [{ value: "أساسي" }, { value: "مميز" }] }
    ]
  }
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
}

function pickTemplate(activity: string, description = "") {
  const normalizedActivity = normalize(activity);
  const normalizedDescription = normalize(description);
  let best = { template: activityTemplates.find((template) => template.key === "general") || activityTemplates[0], score: 0 };

  for (const template of activityTemplates) {
    let score = 0;
    for (const word of template.match) {
      const normalizedWord = normalize(word);
      if (!normalizedWord) continue;
      if (normalizedActivity.includes(normalizedWord)) score += normalizedWord.length > 4 ? 12 : 9;
      if (normalizedDescription.includes(normalizedWord)) score += normalizedWord.length > 4 ? 5 : 3;
    }
    if (score > best.score) best = { template, score };
  }

  return best.score > 0 ? best.template : best.template;
}

function svgDataUrl(title: string, subtitle: string, primary: string, accent: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="700" viewBox="0 0 1400 700"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${primary}"/><stop offset="1" stop-color="${accent}"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="55"/></filter></defs><rect width="1400" height="700" fill="url(#g)"/><circle cx="190" cy="120" r="180" fill="#fff" opacity=".14" filter="url(#blur)"/><circle cx="1180" cy="590" r="240" fill="#fff" opacity=".12" filter="url(#blur)"/><text x="1120" y="285" fill="#fff" font-size="72" font-weight="900" text-anchor="end" font-family="Arial, sans-serif">${escapeXml(title)}</text><text x="1120" y="360" fill="#fff" opacity=".82" font-size="34" text-anchor="end" font-family="Arial, sans-serif">${escapeXml(subtitle)}</text><rect x="880" y="410" width="240" height="70" rx="30" fill="#fff" opacity=".18"/><text x="1000" y="455" fill="#fff" font-size="26" font-weight="700" text-anchor="middle" font-family="Arial, sans-serif">تسوق الآن</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function generateSmartStoreSetupPlan(input: StoreSetupInput): StoreSetupPlan {
  const template = pickTemplate(input.activity, input.description || "");
  const palette = palettes[input.style] || palettes.modern;
  const primaryColor = input.primaryColor || palette.primary;
  const accentColor = input.accentColor || palette.accent;
  const categories = template.categories.map((name) => ({ name, description: `قسم ${name} داخل ${input.storeName}`, icon: "✨", slug: slugify(name) || uniqueSlug(name) }));
  const banners = [
    { title: input.storeName, subtitle: input.description || `وجهتك المختارة في ${input.activity}`, imageUrl: svgDataUrl(input.storeName, input.activity, primaryColor, accentColor), ctaText: "تسوق الآن", ctaUrl: "#products" },
    { title: `عروض ${input.activity}`, subtitle: "تشكيلة مختارة بعناية لتجربة تسوق أفضل", imageUrl: svgDataUrl(`عروض ${input.activity}`, "منتجات مختارة", accentColor, primaryColor), ctaText: "استكشف", ctaUrl: "#categories" }
  ];
  const demoProducts = template.products.map((name, index) => ({
    name: `${name} تجريبي`,
    description: `منتج تجريبي قابل للتعديل داخل ${input.storeName}. تم إنشاؤه ضمن الإعداد الذكي ويمكن حذفه أو تعديله لاحقاً.`,
    categorySlug: categories[index % categories.length]?.slug,
    price: [120, 250, 80, 45][index % 4],
    stock: [10, 8, 15, 20][index % 4],
    imageUrl: svgDataUrl(name, input.storeName, primaryColor, accentColor),
    attributes: { "المصدر": "AI Setup" }
  }));

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    input,
    theme: { name: `${palette.mood} - ${input.activity}`, primaryColor, accentColor, backgroundColor: palette.background, textColor: palette.text, fontFamily: "Tajawal / System", mood: palette.mood },
    layout: [
      { id: "hero", title: "واجهة المتجر", type: "hero", visible: true, sortOrder: 1 },
      { id: "banners", title: "البانرات", type: "banner", visible: true, sortOrder: 2 },
      { id: "categories", title: "الأقسام", type: "categories", visible: true, sortOrder: 3 },
      { id: "products", title: "المنتجات المختارة", type: "featured_products", visible: true, sortOrder: 4 },
      { id: "contact", title: "بيانات التواصل", type: "contact", visible: true, sortOrder: 5 }
    ],
    banners,
    categories,
    attributes: template.attributes,
    demoProducts,
    instructions: [
      "كل عنصر تم إنشاؤه قابل للتعديل أو الحذف من الشاشات التقليدية.",
      "راجع المنتجات التجريبية قبل نشر المتجر على العملاء.",
      "يمكنك إعادة توليد التصميم الذكي في أي وقت دون حذف النظام التقليدي."
    ]
  };
}

export async function getStoreDesignSettings(storeId: string) {
  try {
    const [setting] = await db.select().from(systemSettings).where(and(eq(systemSettings.group, "store_design"), eq(systemSettings.key, storeId))).limit(1);
    return setting?.value as StoreSetupPlan | null;
  } catch {
    return null;
  }
}

export async function applySmartStoreSetup(store: Store, plan: StoreSetupPlan, actorId: string) {
  const result = await db.transaction(async (tx) => {
    const categoryMap = new Map<string, string>();

    await tx.update(stores).set({
      description: store.description || plan.input.description || `متجر متخصص في ${plan.input.activity}`,
      coverImageUrl: plan.banners[0]?.imageUrl || store.coverImageUrl,
      logoUrl: store.logoUrl || svgDataUrl(plan.input.storeName.slice(0, 18), "", plan.theme.primaryColor, plan.theme.accentColor),
      profileCompleteness: Math.max(store.profileCompleteness || 0, 85),
      updatedAt: new Date()
    }).where(eq(stores.id, store.id));

    await tx.insert(systemSettings).values({ group: "store_design", key: store.id, value: plan, isPublic: true, updatedBy: actorId }).onConflictDoUpdate({ target: [systemSettings.group, systemSettings.key], set: { value: plan, isPublic: true, updatedBy: actorId, updatedAt: new Date() } });

    await tx.delete(storeMedia).where(and(eq(storeMedia.storeId, store.id), sql`${storeMedia.alt} like 'AI_SETUP:%'`));
    if (plan.input.includeBanners !== false) {
      await tx.insert(storeMedia).values(plan.banners.map((banner, index) => ({ storeId: store.id, mediaType: "banner" as const, url: banner.imageUrl, alt: `AI_SETUP:${banner.title}`, sortOrder: index, isActive: true })));
    }

    if (plan.input.includeCategories !== false) {
      for (const category of plan.categories) {
        const [existing] = await tx.select({ id: categories.id }).from(categories).where(and(eq(categories.storeId, store.id), eq(categories.slug, category.slug))).limit(1);
        if (existing) {
          categoryMap.set(category.slug, existing.id);
          continue;
        }
        const [created] = await tx.insert(categories).values({ storeId: store.id, name: category.name, slug: category.slug, imageUrl: svgDataUrl(category.name, store.name, plan.theme.primaryColor, plan.theme.accentColor), level: 0, codeMode: "auto", sortOrder: categoryMap.size + 1, isActive: true }).returning({ id: categories.id });
        categoryMap.set(category.slug, created.id);
      }
    }

    if (plan.input.includeAttributes !== false) {
      for (const attr of plan.attributes) {
        const [attribute] = await tx.insert(productAttributes).values({ storeId: store.id, name: attr.name, code: attr.code, displayType: attr.displayType, isVariantOption: true, isRequired: false, sortOrder: 0, isActive: true }).onConflictDoUpdate({ target: [productAttributes.storeId, productAttributes.code], set: { name: attr.name, displayType: attr.displayType, updatedAt: new Date() } }).returning();
        for (const value of attr.values) {
          await tx.insert(productAttributeValues).values({ attributeId: attribute.id, value: value.value, code: value.code, colorHex: value.colorHex, sortOrder: 0, isActive: true }).onConflictDoNothing();
        }
      }
    }

    const createdProducts: string[] = [];
    if (plan.input.includeProducts !== false) {
      for (const demo of plan.demoProducts) {
        const [product] = await tx.insert(products).values({
          storeId: store.id,
          categoryId: categoryMap.get(demo.categorySlug) || null,
          name: demo.name,
          slug: uniqueSlug(demo.name),
          shortDescription: demo.description.slice(0, 220),
          description: demo.description,
          brand: "AI Setup",
          type: "simple",
          status: "draft",
          basePrice: demo.price.toString(),
          mainImageUrl: demo.imageUrl,
          images: [demo.imageUrl],
          specifications: demo.attributes,
          pricingMode: "independent",
          inventoryMode: "variant",
          discountPercent: "0"
        }).returning();
        await tx.insert(productVariants).values({ productId: product.id, sku: `${product.slug}-AI`, title: "افتراضي", price: demo.price.toString(), stockQuantity: demo.stock, lowStockThreshold: 5, imageUrl: demo.imageUrl, images: [demo.imageUrl], attributes: demo.attributes }).onConflictDoNothing();
        createdProducts.push(product.id);
      }
    }

    return { categories: categoryMap.size, products: createdProducts.length, banners: plan.banners.length };
  });

  await writeAuditLog({ actorId, action: "create", entityType: "smart_store_setup", entityId: store.id, afterData: { result, plan } });
  return result;
}
