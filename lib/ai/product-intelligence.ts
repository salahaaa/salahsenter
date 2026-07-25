import crypto from "node:crypto";

const colors = ["أسود", "أبيض", "أحمر", "أزرق", "أخضر", "ذهبي", "فضي", "رمادي", "وردي", "بني"];
const sizes = ["XS", "S", "M", "L", "XL", "XXL", "64GB", "128GB", "256GB", "512GB", "1TB", "2TB"];

function words(value: string) { return value.toLowerCase().split(/[\s،,;:/|\-]+/).filter((word) => word.length > 1); }
function slug(value: string) { return value.normalize("NFKD").replace(/[^\w\u0600-\u06FF]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50).toUpperCase() || "ITEM"; }

export function internalSku(input: { storeNumber: string; productName: string; index?: number }) {
  return `${input.storeNumber.replace(/[^A-Z0-9]/gi, "").slice(-8) || "STORE"}-${slug(input.productName).slice(0, 18)}-${String(input.index || 1).padStart(2, "0")}`;
}

/** Internal reference only; not a GS1/EAN barcode. */
export function internalBarcode(input: { storeId: string; productName: string; index?: number }) {
  const digest = crypto.createHash("sha256").update(`${input.storeId}|${input.productName}|${input.index || 1}`).digest("hex");
  return `YTC${digest.slice(0, 13).toUpperCase()}`;
}

export function inferVariants(text: string) {
  const source = text.toLowerCase(); const colorMatches = colors.filter((color) => source.includes(color.toLowerCase())); const sizeMatches = sizes.filter((size) => source.includes(size.toLowerCase()));
  const selectedColors = colorMatches.length ? colorMatches : []; const selectedSizes = sizeMatches.length ? sizeMatches : [];
  const variants: Array<{ title: string; attributes: Record<string,string> }> = [];
  if (selectedColors.length && selectedSizes.length) for (const color of selectedColors) for (const size of selectedSizes) variants.push({ title: `${color} / ${size}`, attributes: { اللون: color, المقاس: size } });
  else if (selectedColors.length) for (const color of selectedColors) variants.push({ title: color, attributes: { اللون: color } });
  else if (selectedSizes.length) for (const size of selectedSizes) variants.push({ title: size, attributes: { المقاس: size } });
  return { colors: selectedColors, sizes: selectedSizes, variants: variants.slice(0, 30) };
}

export function priceBenchmark(values: Array<number | string | null | undefined>) {
  const numbers = values.map((value) => Number(value || 0)).filter((value) => Number.isFinite(value) && value > 0).sort((a,b)=>a-b);
  if (!numbers.length) return { sampleSize: 0, min: null, median: null, max: null, recommendation: null, source: "platform_internal_only" as const };
  const median = numbers[Math.floor(numbers.length / 2)];
  return { sampleSize: numbers.length, min: numbers[0], median, max: numbers[numbers.length - 1], recommendation: median, source: "platform_internal_only" as const };
}

export function repairImportRow(input: { name?: string | null; sku?: string | null; barcode?: string | null; price?: number | string | null; stock?: number | string | null; description?: string | null; storeNumber: string; storeId: string; index: number }) {
  const name = String(input.name || "").trim(); const issues: string[] = []; const fixes: Record<string, unknown> = {};
  if (!name) issues.push("اسم المنتج مفقود");
  const sku = String(input.sku || "").trim() || (name ? internalSku({ storeNumber: input.storeNumber, productName: name, index: input.index }) : ""); if (!input.sku && sku) fixes.sku = sku;
  const barcode = String(input.barcode || "").trim() || (name ? internalBarcode({ storeId: input.storeId, productName: name, index: input.index }) : ""); if (!input.barcode && barcode) fixes.internalBarcode = barcode;
  const price = Number(input.price || 0); if (!Number.isFinite(price) || price <= 0) issues.push("سعر البيع مفقود أو غير صالح");
  const stock = Number(input.stock || 0); if (!Number.isFinite(stock) || stock < 0) issues.push("كمية المخزون غير صالحة");
  const variants = inferVariants(`${name} ${input.description || ""}`); if (variants.variants.length) fixes.variants = variants.variants;
  return { valid: !issues.length, issues, fixes, suggestedCategoryQuery: words(name).slice(0, 4).join(" ") };
}
