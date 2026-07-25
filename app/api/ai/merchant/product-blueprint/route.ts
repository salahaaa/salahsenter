export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { aiActionProposals, aiLogs, categories, db, productVariants, products, suppliers } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { generateAiText } from "@/lib/ai/gateway";
import { inferVariants, internalBarcode, internalSku, priceBenchmark } from "@/lib/ai/product-intelligence";
import { userHasStoreOperation } from "@/lib/rbac";

const schema = z.object({ productId: z.string().uuid(), details: z.string().trim().max(3_000).optional().nullable() });

export async function POST(request: Request) {
  try {
    const session = await requireAuth(); const store = await getMerchantPrimaryStore(session.userId);
    if (!store || !hasStoreAccess(session, store.id)) return fail("لا يوجد متجر", 403);
    if (!(await userHasStoreOperation(session.userId, store.id, "ai.use"))) return fail("لا تملك صلاحية ذكاء المتجر", 403);
    const payload = schema.parse(await request.json());
    const [product] = await db.select().from(products).where(and(eq(products.id, payload.productId), eq(products.storeId, store.id))).limit(1);
    if (!product) return fail("المنتج غير موجود", 404);
    const [categoryRows, supplierRows, priceRows] = await Promise.all([
      db.select().from(categories).where(eq(categories.storeId, store.id)).limit(200),
      db.select().from(suppliers).where(eq(suppliers.storeId, store.id)).limit(200),
      product.categoryId ? db.select({ price: productVariants.price }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(and(eq(products.storeId, store.id), eq(products.categoryId, product.categoryId), eq(productVariants.isActive, true))).limit(500) : Promise.resolve([])
    ]);
    const text = `${product.name} ${product.description || ""} ${payload.details || ""}`;
    const variants = inferVariants(text);
    const category = categoryRows.find((item) => text.toLowerCase().includes(item.name.toLowerCase())) || categoryRows.find((item) => item.id === product.categoryId) || null;
    const supplier = supplierRows.find((item) => text.toLowerCase().includes(item.name.toLowerCase())) || null;
    const benchmark = priceBenchmark(priceRows.map((row) => row.price));
    const sku = internalSku({ storeNumber: store.storeNumber, productName: product.name });
    const barcode = internalBarcode({ storeId: store.id, productName: product.name });
    const external = await generateAiText({ system: "أنت مساعد كتالوج. لا تقترح ادعاءات غير مؤكدة ولا سعراً خارج benchmark الداخلي.", prompt: `منتج: ${product.name}. عدد variants المستنتجة ${variants.variants.length}.`, fallback: `اقتراح category: ${category?.name || "راجعه يدوياً"}. variants: ${variants.variants.map((item) => item.title).join("، ") || "لا توجد"}. سعر benchmark داخلي: ${benchmark.median || "لا توجد عينة"}.` });
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [proposal] = await db.transaction(async (tx) => {
      await tx.insert(aiLogs).values({ storeId: store.id, userId: session.userId, role: "assistant", prompt: `product_blueprint:${product.id}`, response: external.text, metadata: { provider: external.provider, external: external.external, benchmark } });
      return tx.insert(aiActionProposals).values({ userId: session.userId, storeId: store.id, audience: "merchant", taskType: "product_blueprint", title: `Blueprint للصنف: ${product.name}`, description: "تصنيف وخصائص وvariants وSKU/مرجع داخلي وسعر benchmark. لا يغير السعر أو المخزون أو النشر.", actionType: "apply_product_blueprint", payload: { productId: product.id, storeId: store.id, categoryId: category?.id || null, categoryName: category?.name || null, variants: variants.variants, attributes: { colors: variants.colors, sizes: variants.sizes }, suggestedSku: sku, suggestedInternalBarcode: barcode, supplierId: supplier?.id || null, priceBenchmark: benchmark }, riskLevel: "medium", status: "pending_approval", provider: external.provider, model: external.model, expiresAt }).returning();
    });
    return created({ proposal, blueprint: proposal.payload, narrative: external.text, message: "تم إنشاء Blueprint. راجعه ثم اعتمده لإنشاء attributes/variants وربط المورد فقط." });
  } catch (error) { return handleApiError(error, "تعذر إنشاء Blueprint للمنتج"); }
}
