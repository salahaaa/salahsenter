import { normalizeArabic } from "@/lib/ai/merchant-bundle-suggester";

type CategoryOption = { id: string; name: string; code?: string | null };
type AttributeOption = { id: string; name: string; code: string; values: Array<{ id: string; value: string; code?: string | null }> };

const colorWords = ["أسود", "أبيض", "أحمر", "أزرق", "أخضر", "رمادي", "بني", "بيج", "وردي", "ذهبي", "فضي", "طبيعي"];
const sizeWords = ["XS", "S", "M", "L", "XL", "XXL", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "صغير", "متوسط", "كبير", "عائلي", "250 جم", "500 جم", "1 كيلو", "5 كيلو", "10 كيلو", "25 كيلو", "500ml", "1 لتر"];

function matchWords(source: string, values: string[]) {
  const normalized = normalizeArabic(source);
  return values.filter((value) => normalized.includes(normalizeArabic(value)));
}

function pickCategory(prompt: string, categories: CategoryOption[]) {
  const normalized = normalizeArabic(prompt);
  return categories
    .map((category) => ({ category, score: normalizeArabic(category.name).split(" ").filter((part) => part.length > 1 && normalized.includes(part)).length }))
    .sort((a, b) => b.score - a.score)[0];
}

function inferProductName(prompt: string) {
  const clean = prompt.replace(/أضف|اضف|منتج|صنف|بسعر|السعر|مخزون|كمية|وصف|اكتب|اعمل|لي/gi, " ").replace(/\s+/g, " ").trim();
  return clean.split(/[،,.\n]/)[0]?.trim().slice(0, 120) || "منتج جديد";
}

function inferPrice(prompt: string) {
  const normalized = normalizeArabic(prompt);
  const match = normalized.match(/(?:سعر|بسعر|بـ|ب)\s*(\d+(?:\.\d+)?)/) || normalized.match(/(\d+(?:\.\d+)?)\s*(?:ريال|ر\.ي|ر\.س|دولار)/);
  return match ? Number(match[1]) : undefined;
}

function inferStock(prompt: string) {
  const normalized = normalizeArabic(prompt);
  const match = normalized.match(/(?:مخزون|كمية|عدد)\s*(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function inferBrand(prompt: string) {
  const match = prompt.match(/(?:ماركة|براند|العلامة)\s+([\p{L}\p{N}\s-]{2,30})/u);
  return match?.[1]?.trim();
}

function buildDescription(input: { name: string; category?: string; colors: string[]; sizes: string[]; brand?: string; prompt: string }) {
  const parts = [
    `${input.name} منتج مختار بعناية ليناسب احتياج العميل اليومي ويمنح تجربة شراء واضحة وسهلة.`,
    input.category ? `ينتمي إلى قسم ${input.category}، وتم تنظيمه ليسهل على المتسوق الوصول إليه ومقارنة خياراته.` : "تمت صياغة بياناته بطريقة تسهل عرضه داخل المتجر والبحث عنه.",
    input.sizes.length ? `يتوفر بخيارات مقاس/حجم مثل: ${input.sizes.join("، ")}.` : "يمكن إضافة المقاسات أو الأحجام المناسبة من إعدادات المتجر عند الحاجة.",
    input.colors.length ? `الألوان المقترحة: ${input.colors.join("، ")}.` : "يمكن ربطه بألوان متعددة إذا كان النشاط يحتاج ذلك.",
    input.brand ? `العلامة التجارية: ${input.brand}.` : ""
  ].filter(Boolean);
  return parts.join("\n");
}

function suggestAttributeValues(prompt: string, attributes: AttributeOption[]) {
  const normalized = normalizeArabic(prompt);
  const explicitColors = matchWords(prompt, colorWords);
  const explicitSizes = matchWords(prompt, sizeWords);
  return attributes.map((attribute) => {
    const attrName = normalizeArabic(attribute.name);
    const values = attribute.values.filter((value) => {
      const valueName = normalizeArabic(value.value);
      if (normalized.includes(valueName)) return true;
      if (/لون/.test(attrName) && explicitColors.some((color) => normalizeArabic(color) === valueName)) return true;
      if (/مقاس|حجم|وزن|سعه|سعة/.test(attrName) && explicitSizes.some((size) => normalizeArabic(size) === valueName)) return true;
      return false;
    });
    if (!values.length && /لون/.test(attrName)) return { attributeId: attribute.id, attributeName: attribute.name, valueIds: attribute.values.slice(0, 3).map((value) => value.id) };
    if (!values.length && /مقاس|حجم|وزن|سعه|سعة/.test(attrName)) return { attributeId: attribute.id, attributeName: attribute.name, valueIds: attribute.values.slice(0, 4).map((value) => value.id) };
    return { attributeId: attribute.id, attributeName: attribute.name, valueIds: values.slice(0, 8).map((value) => value.id) };
  }).filter((item) => item.valueIds.length);
}

export function suggestProductDraft(input: { prompt: string; categories: CategoryOption[]; attributes: AttributeOption[] }) {
  const name = inferProductName(input.prompt);
  const categoryScore = pickCategory(input.prompt, input.categories);
  const category = categoryScore?.score ? categoryScore.category : undefined;
  const colors = matchWords(input.prompt, colorWords);
  const sizes = matchWords(input.prompt, sizeWords);
  const brand = inferBrand(input.prompt);
  const basePrice = inferPrice(input.prompt);
  const stockQuantity = inferStock(input.prompt) ?? 5;
  const attributeSelections = suggestAttributeValues(input.prompt, input.attributes);
  const specifications: Record<string, string> = {};
  if (brand) specifications["العلامة التجارية"] = brand;
  if (category) specifications["القسم"] = category.name;
  if (colors.length) specifications["الألوان"] = colors.join("، ");
  if (sizes.length) specifications["المقاسات/الأحجام"] = sizes.join("، ");

  return {
    name,
    categoryId: category?.id || null,
    brand: brand || "",
    basePrice: basePrice || 0,
    stockQuantity,
    shortDescription: `${name}${category ? ` — ${category.name}` : ""}${colors.length ? ` — ألوان ${colors.join("، ")}` : ""}.`,
    description: buildDescription({ name, category: category?.name, colors, sizes, brand, prompt: input.prompt }),
    specifications,
    attributeSelections,
    confidenceScore: Math.min(95, 40 + (category ? 15 : 0) + (basePrice ? 10 : 0) + (colors.length ? 10 : 0) + (sizes.length ? 10 : 0) + (attributeSelections.length ? 10 : 0))
  };
}
