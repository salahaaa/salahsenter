export type CatalogQualityInput = {
  name?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  categoryId?: string | null;
  mainImageUrl?: string | null;
  images?: string[] | null;
  basePrice?: string | number | null;
  productCode?: string | null;
  barcode?: string | null;
  specifications?: Record<string, string> | null;
  variants?: Array<{ sku?: string | null; barcode?: string | null; price?: string | number | null; stockQuantity?: number | null; imageUrl?: string | null }>;
};

export type CatalogQualityResult = { score: number; ready: boolean; checks: Array<{ key: string; label: string; score: number; max: number; ok: boolean; hint: string }> };

function nonEmpty(value: string | null | undefined, min = 1) { return String(value || "").trim().length >= min; }
function numberValue(value: string | number | null | undefined) { const n = Number(value || 0); return Number.isFinite(n) ? n : 0; }

export function calculateCatalogQuality(input: CatalogQualityInput): CatalogQualityResult {
  const variants = input.variants || [];
  const imageCount = new Set([input.mainImageUrl, ...(input.images || []), ...variants.map((variant) => variant.imageUrl)].filter(Boolean)).size;
  const prices = [numberValue(input.basePrice), ...variants.map((variant) => numberValue(variant.price))];
  const stock = variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stockQuantity || 0)), 0);
  const skuCoverage = variants.length ? variants.filter((variant) => nonEmpty(variant.sku)).length / variants.length : 0;
  const barcodeCoverage = Boolean(input.barcode) || variants.some((variant) => nonEmpty(variant.barcode));
  const specsCount = Object.keys(input.specifications || {}).filter((key) => nonEmpty(key) && nonEmpty(input.specifications?.[key])).length;
  const checks = [
    { key: "identity", label: "العنوان والوصف", score: nonEmpty(input.name, 3) && (nonEmpty(input.shortDescription, 20) || nonEmpty(input.description, 60)) ? 15 : nonEmpty(input.name, 3) ? 7 : 0, max: 15, hint: "أضف اسمًا واضحًا ووصفًا مختصرًا أو تفصيليًا." },
    { key: "category", label: "التصنيف", score: input.categoryId ? 15 : 0, max: 15, hint: "اربط المنتج بقسم صحيح ليسهل البحث والمقارنة." },
    { key: "media", label: "الوسائط", score: imageCount >= 3 ? 20 : imageCount === 2 ? 14 : imageCount === 1 ? 7 : 0, max: 20, hint: "أضف صورة رئيسية وصورتين داعمتين على الأقل." },
    { key: "pricing", label: "السعر والمخزون", score: prices.some((price) => price > 0) && (variants.length === 0 || stock > 0) ? 15 : prices.some((price) => price > 0) ? 8 : 0, max: 15, hint: "أدخل سعرًا صالحًا وتحقق من مخزون المتغيرات." },
    { key: "specs", label: "المواصفات", score: specsCount >= 5 ? 15 : specsCount >= 3 ? 10 : specsCount >= 1 ? 5 : 0, max: 15, hint: "أدخل المواصفات المهمة للقطاع مثل المقاس أو الضمان أو السعة." },
    { key: "codes", label: "SKU والباركود", score: (variants.length === 0 || skuCoverage === 1) && (barcodeCoverage || nonEmpty(input.productCode)) ? 10 : skuCoverage > 0 || barcodeCoverage || nonEmpty(input.productCode) ? 5 : 0, max: 10, hint: "أكمل SKU لكل متغير واستخدم باركودًا أو كود منتج عند توفره." },
    { key: "variants", label: "الخيارات", score: variants.length === 0 || variants.every((variant) => nonEmpty(variant.sku) && numberValue(variant.price) > 0) ? 10 : 4, max: 10, hint: "راجع سعر وSKU كل متغير قبل النشر." }
  ].map((check) => ({ ...check, ok: check.score === check.max }));
  const score = checks.reduce((sum, check) => sum + check.score, 0);
  return { score, ready: score >= 70 && checks.every((check) => !["category", "pricing"].includes(check.key) || check.ok), checks };
}
