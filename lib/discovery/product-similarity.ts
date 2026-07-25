export type ProductSimilarityInput = {
  id: string;
  storeId: string;
  name: string;
  englishName?: string | null;
  brand?: string | null;
  categoryName?: string | null;
  barcode?: string | null;
  variantBarcodes?: string[];
  inStock?: boolean;
};

export type ProductMatch = {
  score: number;
  confidence: "exact" | "strong" | "similar" | "weak";
  reasons: string[];
  tokenOverlap: number;
};

const stopWords = new Set(["من", "في", "على", "مع", "الى", "عن", "ال", "the", "and", "for", "new", "original", "اصلي", "جديد", "منتج", "منتجات", "قطعة", "قطعه", "موديل"]);

export function normalizeProductText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/ـ/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function productTokens(value: string | null | undefined) {
  return [...new Set(normalizeProductText(value).split(" ").filter((token) => token.length >= 2 && !stopWords.has(token)))];
}

function normalizedBarcodeSet(input: ProductSimilarityInput) {
  return new Set([input.barcode, ...(input.variantBarcodes || [])].map((value) => String(value || "").trim()).filter(Boolean));
}

function overlapScore(reference: string[], candidate: string[]) {
  if (!reference.length || !candidate.length) return 0;
  const candidateSet = new Set(candidate);
  return reference.filter((token) => candidateSet.has(token)).length / reference.length;
}

/**
 * Explainable, sector-neutral similarity. Exact barcode wins; otherwise the
 * engine blends normalized title overlap, brand and category label. It is not
 * presented as an exact SKU match unless the evidence supports that claim.
 */
export function scoreProductSimilarity(reference: ProductSimilarityInput, candidate: ProductSimilarityInput): ProductMatch {
  const reasons: string[] = [];
  const referenceBarcodes = normalizedBarcodeSet(reference);
  const candidateBarcodes = normalizedBarcodeSet(candidate);
  const barcodeMatch = [...referenceBarcodes].some((barcode) => candidateBarcodes.has(barcode));
  if (barcodeMatch) {
    reasons.push("نفس الباركود");
    return { score: 100, confidence: "exact", reasons, tokenOverlap: 1 };
  }

  const referenceName = normalizeProductText(`${reference.name} ${reference.englishName || ""}`);
  const candidateName = normalizeProductText(`${candidate.name} ${candidate.englishName || ""}`);
  const referenceTokens = productTokens(referenceName);
  const candidateTokens = productTokens(candidateName);
  const tokenOverlap = overlapScore(referenceTokens, candidateTokens);
  const sameName = Boolean(referenceName && referenceName === candidateName);
  const sameBrand = Boolean(normalizeProductText(reference.brand) && normalizeProductText(reference.brand) === normalizeProductText(candidate.brand));
  const sameCategory = Boolean(normalizeProductText(reference.categoryName) && normalizeProductText(reference.categoryName) === normalizeProductText(candidate.categoryName));

  let score = Math.round(tokenOverlap * 55);
  if (sameName) { score += 35; reasons.push("اسم مطابق"); }
  else if (tokenOverlap >= 0.6) reasons.push("اسم قريب");
  if (sameBrand) { score += 22; reasons.push("نفس العلامة التجارية"); }
  if (sameCategory) { score += 14; reasons.push("ضمن نفس الفئة"); }
  if (candidate.inStock) score += 4;
  score = Math.min(99, score);

  const confidence = sameName && sameBrand
    ? "exact"
    : score >= 72
      ? "strong"
      : score >= 40
        ? "similar"
        : "weak";
  if (!reasons.length && sameCategory) reasons.push("فئة قريبة");
  if (!reasons.length) reasons.push("تشابه في وصف المنتج");
  return { score, confidence, reasons, tokenOverlap };
}
