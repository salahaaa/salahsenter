import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { client, colors, db, inventoryMovements, productAttributes, productAttributeValues, productVariantAttributeValues, productVariants, products, sizes, stores } from "@/lib/db";

const targetStoreSlugs = [
  "al-sabri-home-tools",
  "biki-smart-shopping",
  "elite-fashion-import",
  "tech-world-import",
  "family-furniture-import"
];

type OptionCombo = { size: string; color: string; hex: string };

type StoreRow = typeof stores.$inferSelect;
type ProductRow = typeof products.$inferSelect;
type VariantRow = typeof productVariants.$inferSelect;

type AttributeBundle = {
  sizeAttributeId: string;
  colorAttributeId: string;
  sizeValueByName: Map<string, string>;
  colorValueByName: Map<string, string>;
  sizeRowByName: Map<string, string>;
  colorRowByName: Map<string, { id: string; hex: string }>;
};

const colorHex: Record<string, string> = {
  "أسود": "#111827",
  "أبيض": "#f8fafc",
  "رمادي": "#64748b",
  "أزرق": "#2563eb",
  "أزرق فاتح": "#38bdf8",
  "بني": "#92400e",
  "بيج": "#d6b48c",
  "عسلي": "#b7791f",
  "أحمر": "#dc2626",
  "وردي": "#ec4899",
  "أصفر": "#facc15",
  "نيلي": "#4f46e5",
  "ذهبي": "#d4af37",
  "فضي": "#94a3b8",
  "أخضر": "#16a34a",
  "طبيعي": "#c08457",
  "سماوي": "#0ea5e9"
};

function normalize(value: string) {
  return value.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").toLowerCase();
}

function optionSet(product: ProductRow): OptionCombo[] {
  const text = normalize(`${product.name} ${product.description || ""}`);
  if (/حذاء|شوز|سنيكر|جري/.test(text)) {
    return [
      { size: "39", color: "أسود", hex: colorHex["أسود"] },
      { size: "40", color: "أبيض", hex: colorHex["أبيض"] },
      { size: "41", color: "أزرق", hex: colorHex["أزرق"] },
      { size: "42", color: "رمادي", hex: colorHex["رمادي"] },
      { size: "43", color: "أسود", hex: colorHex["أسود"] },
      { size: "44", color: "أبيض", hex: colorHex["أبيض"] }
    ];
  }
  if (/قميص|بنطلون|جاكيت|فستان|بلوزه|ملابس|ازياء|قطني|جلد طبيعي/.test(text)) {
    return [
      { size: "S", color: "أبيض", hex: colorHex["أبيض"] },
      { size: "M", color: "أسود", hex: colorHex["أسود"] },
      { size: "L", color: "أزرق", hex: colorHex["أزرق"] },
      { size: "XL", color: "رمادي", hex: colorHex["رمادي"] },
      { size: "XXL", color: "بني", hex: colorHex["بني"] }
    ];
  }
  if (/حقيبه|نظاره|عطر|مكياج|العنايه|البشره|سماعه|هاتف|شاحن|كيبورد|ساعة|مصباح/.test(text)) {
    return [
      { size: "قياسي", color: "أسود", hex: colorHex["أسود"] },
      { size: "قياسي", color: "أبيض", hex: colorHex["أبيض"] },
      { size: "قياسي", color: "أزرق", hex: colorHex["أزرق"] },
      { size: "قياسي", color: "ذهبي", hex: colorHex["ذهبي"] }
    ];
  }
  if (/كنبه|طاول|اثاث|خزانة|منظم|وسادة|اواني|طقم|محضره|مكنسه|ممسحه|منظف|حمام/.test(text)) {
    return [
      { size: "صغير", color: "رمادي", hex: colorHex["رمادي"] },
      { size: "متوسط", color: "بيج", hex: colorHex["بيج"] },
      { size: "كبير", color: "بني", hex: colorHex["بني"] },
      { size: "عائلي", color: "أسود", hex: colorHex["أسود"] }
    ];
  }
  return [
    { size: "صغير", color: "أسود", hex: colorHex["أسود"] },
    { size: "متوسط", color: "أبيض", hex: colorHex["أبيض"] },
    { size: "كبير", color: "رمادي", hex: colorHex["رمادي"] }
  ];
}

function optionCode(value: string) {
  return value.replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").toLowerCase().slice(0, 60);
}

async function ensureAttribute(storeId: string, name: string, code: string, displayType: string, sortOrder: number) {
  let [row] = await db.select().from(productAttributes).where(and(eq(productAttributes.storeId, storeId), eq(productAttributes.code, code))).limit(1);
  if (!row) {
    [row] = await db.insert(productAttributes).values({ storeId, name, code, displayType, isVariantOption: true, isRequired: false, sortOrder, isActive: true }).returning();
  } else if (!row.isActive) {
    [row] = await db.update(productAttributes).set({ isActive: true, updatedAt: new Date() }).where(eq(productAttributes.id, row.id)).returning();
  }
  return row;
}

async function ensureAttributeValue(attributeId: string, value: string, hex: string | null, sortOrder: number) {
  const code = optionCode(value);
  const existing = await db.select().from(productAttributeValues).where(and(eq(productAttributeValues.attributeId, attributeId), eq(productAttributeValues.value, value))).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db.insert(productAttributeValues).values({ attributeId, value, code, colorHex: hex, sortOrder, isActive: true }).returning();
  return created;
}

async function ensureSizeRow(storeId: string, name: string, sortOrder: number) {
  let [row] = await db.select().from(sizes).where(and(eq(sizes.storeId, storeId), eq(sizes.name, name))).limit(1);
  if (!row) [row] = await db.insert(sizes).values({ storeId, name, isActive: true, sortOrder }).returning();
  return row;
}

async function ensureColorRow(storeId: string, name: string, hexCode: string, sortOrder: number) {
  let [row] = await db.select().from(colors).where(and(eq(colors.storeId, storeId), eq(colors.name, name))).limit(1);
  if (!row) [row] = await db.insert(colors).values({ storeId, name, hexCode, isActive: true, sortOrder }).returning();
  return row;
}

async function ensureStoreOptions(store: StoreRow, combos: OptionCombo[]): Promise<AttributeBundle> {
  const sizeAttr = await ensureAttribute(store.id, "المقاس", "size", "button", 1);
  const colorAttr = await ensureAttribute(store.id, "اللون", "color", "color", 2);
  const uniqueSizes = [...new Set(combos.map((combo) => combo.size))];
  const uniqueColors = [...new Map(combos.map((combo) => [combo.color, combo.hex])).entries()];
  const sizeValueByName = new Map<string, string>();
  const colorValueByName = new Map<string, string>();
  const sizeRowByName = new Map<string, string>();
  const colorRowByName = new Map<string, { id: string; hex: string }>();

  for (let index = 0; index < uniqueSizes.length; index++) {
    const sizeName = uniqueSizes[index];
    const [sizeValue, sizeRow] = await Promise.all([
      ensureAttributeValue(sizeAttr.id, sizeName, null, index),
      ensureSizeRow(store.id, sizeName, index)
    ]);
    sizeValueByName.set(sizeName, sizeValue.id);
    sizeRowByName.set(sizeName, sizeRow.id);
  }
  for (let index = 0; index < uniqueColors.length; index++) {
    const [colorName, hex] = uniqueColors[index];
    const [colorValue, colorRow] = await Promise.all([
      ensureAttributeValue(colorAttr.id, colorName, hex, index),
      ensureColorRow(store.id, colorName, hex, index)
    ]);
    colorValueByName.set(colorName, colorValue.id);
    colorRowByName.set(colorName, { id: colorRow.id, hex });
  }
  return { sizeAttributeId: sizeAttr.id, colorAttributeId: colorAttr.id, sizeValueByName, colorValueByName, sizeRowByName, colorRowByName };
}

function distribute(total: number, parts: number) {
  const safeTotal = Math.max(parts, total || parts * 3);
  const base = Math.floor(safeTotal / parts);
  const remainder = safeTotal % parts;
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
}

async function linkVariantOptions(variantId: string, bundle: AttributeBundle, combo: OptionCombo) {
  await db.delete(productVariantAttributeValues).where(and(eq(productVariantAttributeValues.variantId, variantId), inArray(productVariantAttributeValues.attributeId, [bundle.sizeAttributeId, bundle.colorAttributeId])));
  const sizeValueId = bundle.sizeValueByName.get(combo.size);
  const colorValueId = bundle.colorValueByName.get(combo.color);
  if (sizeValueId) await db.insert(productVariantAttributeValues).values({ variantId, attributeId: bundle.sizeAttributeId, valueId: sizeValueId }).onConflictDoNothing();
  if (colorValueId) await db.insert(productVariantAttributeValues).values({ variantId, attributeId: bundle.colorAttributeId, valueId: colorValueId }).onConflictDoNothing();
}

async function ensureProductVariants(store: StoreRow, product: ProductRow) {
  const combos = optionSet(product);
  const bundle = await ensureStoreOptions(store, combos);
  const existing = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
  const optionVariants = existing.filter((variant) => variant.sku.includes("-OPT-"));
  const baseVariant = existing.find((variant) => !variant.sku.includes("-OPT-")) || existing[0];
  if (!baseVariant) return { productId: product.id, created: 0, updated: 0 };

  const totalStock = Math.max(combos.length, existing.reduce((sum, variant) => sum + Number(variant.stockQuantity || 0), 0));
  const stocks = distribute(totalStock, combos.length);
  const basePrice = Number(baseVariant.price || product.basePrice || 0);
  const baseSku = product.productCode || baseVariant.sku || product.slug;
  let created = 0;
  let updated = 0;

  await db.update(products).set({ type: "variable", inventoryMode: "variant", pricingMode: "independent", updatedAt: new Date() }).where(eq(products.id, product.id));

  for (let index = 0; index < combos.length; index++) {
    const combo = combos[index];
    const title = `${combo.size} / ${combo.color}`;
    const sizeId = bundle.sizeRowByName.get(combo.size) || null;
    const colorId = bundle.colorRowByName.get(combo.color)?.id || null;
    const stockQuantity = stocks[index];
    const attributes = { المقاس: combo.size, اللون: combo.color };
    let variant: VariantRow | undefined;
    const sku = index === 0 ? baseVariant.sku : `${baseSku}-OPT-${optionCode(combo.size)}-${optionCode(combo.color)}`.slice(0, 110);

    if (index === 0) {
      const before = baseVariant.stockQuantity;
      [variant] = await db.update(productVariants).set({ title, sizeId, colorId, stockQuantity, attributes, imageUrl: product.mainImageUrl || baseVariant.imageUrl, images: product.images?.length ? product.images : baseVariant.images, isActive: true, updatedAt: new Date() }).where(eq(productVariants.id, baseVariant.id)).returning();
      updated += 1;
      if (before !== stockQuantity) {
        await db.insert(inventoryMovements).values({ storeId: store.id, productId: product.id, variantId: baseVariant.id, type: "adjust", quantity: Math.abs(stockQuantity - before), beforeQuantity: before, afterQuantity: stockQuantity, reason: "Variant option enrichment stock distribution" }).onConflictDoNothing();
      }
    } else {
      const existingOption = optionVariants.find((variant) => variant.sku === sku);
      if (existingOption) {
        [variant] = await db.update(productVariants).set({ title, sizeId, colorId, price: basePrice.toString(), compareAtPrice: baseVariant.compareAtPrice, stockQuantity, attributes, imageUrl: product.mainImageUrl || existingOption.imageUrl, images: product.images?.length ? product.images : existingOption.images, isActive: true, updatedAt: new Date() }).where(eq(productVariants.id, existingOption.id)).returning();
        updated += 1;
      } else {
        [variant] = await db.insert(productVariants).values({ productId: product.id, sku, title, sizeId, colorId, price: basePrice.toString(), compareAtPrice: baseVariant.compareAtPrice, priceAdjustment: "0", stockQuantity, lowStockThreshold: Math.max(2, Math.floor(stockQuantity * 0.25)), imageUrl: product.mainImageUrl || baseVariant.imageUrl, images: product.images?.length ? product.images : baseVariant.images, attributes, isActive: true }).returning();
        created += 1;
        await db.insert(inventoryMovements).values({ storeId: store.id, productId: product.id, variantId: variant.id, type: "add", quantity: stockQuantity, beforeQuantity: 0, afterQuantity: stockQuantity, reason: "Variant option enrichment initial stock" }).onConflictDoNothing();
      }
    }
    if (variant) await linkVariantOptions(variant.id, bundle, combo);
  }
  return { productId: product.id, created, updated };
}

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.APP_ENV === "production" || process.env.VERCEL_ENV === "production") throw new Error("Fixture product enrichment محظور في الإنتاج.");
  if (process.env.PRODUCT_OPTIONS_ENRICHMENT !== "true") throw new Error("عيّن PRODUCT_OPTIONS_ENRICHMENT=true لتأكيد تعديل بيانات fixtures خارج الإنتاج.");
  const targetStores = await db.select().from(stores).where(inArray(stores.slug, targetStoreSlugs));
  const summary = [];
  for (const store of targetStores) {
    const storeProducts = await db.select().from(products).where(eq(products.storeId, store.id));
    let createdVariants = 0;
    let updatedVariants = 0;
    for (const product of storeProducts) {
      const result = await ensureProductVariants(store, product);
      createdVariants += result.created;
      updatedVariants += result.updated;
    }
    const sizesCount = await db.select().from(sizes).where(eq(sizes.storeId, store.id));
    const colorsCount = await db.select().from(colors).where(eq(colors.storeId, store.id));
    summary.push({ store: store.name, products: storeProducts.length, sizes: sizesCount.length, colors: colorsCount.length, createdVariants, updatedVariants });
  }
  console.log(JSON.stringify({ stores: summary.length, summary }, null, 2));
}

main().finally(async () => {
  await client.end({ timeout: 5 }).catch(() => undefined);
});
