import { and, desc, eq, inArray } from "drizzle-orm";
import { aiActionProposals, aiLogs, db, merchantApplications, productAttributeValues, productAttributes, productSuppliers, productVariants, products, storeLaunchReadiness, stores } from "@/lib/db";
import { buildMerchantAiInsights } from "@/lib/enterprise/merchant-ai";
import { getAdminWorkQueue } from "@/lib/admin/work-queue";
import { generateAiText } from "@/lib/ai/gateway";

type Audience = "merchant" | "admin" | "customer";
export type AiProposal = { title: string; description: string; actionType: string; payload: Record<string, unknown>; riskLevel: "low" | "medium" | "high" };

export async function runAiWorkbench(input: { userId: string | null; audience: Audience; storeId?: string | null; task: string; prompt?: string | null }) {
  let fallback = ""; let proposals: AiProposal[] = []; let context: Record<string, unknown> = {};
  if (input.audience === "merchant") {
    if (!input.userId) throw new Error("يلزم تسجيل الدخول لذكاء التاجر");
    const insights = await buildMerchantAiInsights(input.userId); context = { storeId: insights.store?.id || null, metrics: insights.dashboard.metrics, recommendations: insights.recommendations };
    fallback = insights.recommendations.length ? insights.recommendations.map((item, index) => `${index + 1}. ${item.title}: ${item.description}`).join("\n") : "ابدأ بإكمال الكتالوج ووسائل الدفع والشحن ثم راجع جاهزية الإطلاق.";
    proposals = insights.recommendations.slice(0, 4).map((item) => ({ title: item.title, description: item.description, actionType: "open_merchant_workflow", payload: { actionUrl: item.actionUrl, data: item.data || {} }, riskLevel: item.severity === "danger" ? "medium" : "low" }));
  } else if (input.audience === "admin") {
    if (!input.userId) throw new Error("يلزم تسجيل الدخول لذكاء الأدمن");
    const queue = await getAdminWorkQueue({ limit: 25 }); const urgent = queue.slice(0, 8);
    context = { urgent: urgent.map((item) => ({ title: item.title, queue: item.queue, priority: item.priority, href: item.href })) };
    fallback = urgent.length ? urgent.map((item, index) => `${index + 1}. [${item.priority}] ${item.title} — ${item.description}`).join("\n") : "لا توجد مهام تشغيلية مفتوحة ذات أولوية مرتفعة.";
    proposals = urgent.slice(0, 5).map((item) => ({ title: `مراجعة: ${item.title}`, description: `افتح المهمة وراجع الدليل قبل اتخاذ القرار. ${item.description}`, actionType: "open_admin_workflow", payload: { href: item.href, workKey: item.workKey }, riskLevel: item.priority === "critical" ? "high" : "medium" }));
  } else {
    fallback = "يمكنني مساعدتك في اكتشاف المنتجات، المقارنة، فهم وسائل الدفع والشحن، وتتبع الطلب. سأعرض اقتراحات ولا أؤكد التوفر أو السعر النهائي إلا من صفحة المنتج والمتجر.";
    proposals = [{ title: "ابدأ بحثاً ذكياً", description: "اكتب ما تريد شراؤه مع الميزانية أو المواصفات، وسنعرض منتجات ومتاجر مناسبة.", actionType: "open_customer_search", payload: { href: "/" }, riskLevel: "low" }];
  }
  const prompt = input.prompt?.trim() || `نفذ المهمة: ${input.task}`;
  // External providers receive only aggregated/anonymous context. Detailed store, document,
  // customer and financial records stay in the deterministic local recommendation layer.
  const externalContext = { audience: input.audience, task: input.task, recommendationCount: proposals.length, policy: "اقتراحات فقط؛ لا تنفيذ أو قرار قانوني/مالي" };
  const generated = await generateAiText({ system: "أنت مساعد منصة Yemeni Trade Center. قدم إجابات عربية واضحة، لا تتخذ قراراً قانونياً أو مالياً ولا تنفذ تغييراً دون موافقة.", prompt: `${prompt}\nالسياق المسموح: ${JSON.stringify(externalContext)}`, fallback });
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const stored = await db.transaction(async (tx) => {
    await tx.insert(aiLogs).values({ storeId: input.storeId || (context.storeId as string | null) || null, userId: input.userId, role: "assistant", prompt, response: generated.text, metadata: { audience: input.audience, task: input.task, provider: generated.provider, model: generated.model, external: generated.external, safetyMode: generated.safetyMode } });
    if (!proposals.length || !input.userId) return [];
    return tx.insert(aiActionProposals).values(proposals.map((proposal) => ({ userId: input.userId, storeId: input.storeId || (context.storeId as string | null) || null, audience: input.audience, taskType: input.task, title: proposal.title, description: proposal.description, actionType: proposal.actionType, payload: proposal.payload, riskLevel: proposal.riskLevel, status: "pending_approval", provider: generated.provider, model: generated.model, expiresAt }))).returning();
  });
  return { response: generated, context, proposals: stored };
}

export async function listAiProposals(input: { userId: string; audience?: Audience; storeId?: string | null }) {
  const conditions = [eq(aiActionProposals.userId, input.userId), inArray(aiActionProposals.status, ["pending_approval", "approved"])];
  if (input.audience) conditions.push(eq(aiActionProposals.audience, input.audience));
  if (input.storeId) conditions.push(eq(aiActionProposals.storeId, input.storeId));
  return db.select().from(aiActionProposals).where(and(...conditions)).orderBy(desc(aiActionProposals.createdAt)).limit(100);
}

/** Approval records an explicit human decision; domain mutation remains in its dedicated workflow URL. */
export async function approveAiProposal(input: { proposalId: string; userId: string }) {
  const [before] = await db.select().from(aiActionProposals).where(eq(aiActionProposals.id, input.proposalId)).limit(1);
  if (!before || before.userId !== input.userId) throw new Error("اقتراح الذكاء غير موجود أو لا تملكه");
  if (before.status !== "pending_approval" || before.expiresAt < new Date()) throw new Error("اقتراح الذكاء منتهٍ أو تمت معالجته");
  const now = new Date();
  let executionResult: Record<string, unknown> = { approved: true, nextAction: before.payload };
  if (before.actionType === "apply_product_blueprint") {
    const payload = before.payload as any; const productId = String(payload.productId || ""); const storeId = String(payload.storeId || "");
    const [product] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.storeId, storeId))).limit(1);
    if (!product) throw new Error("المنتج المقترح غير موجود ضمن المتجر");
    const existingVariants = await db.select().from(productVariants).where(eq(productVariants.productId, product.id));
    const attrs = payload.attributes || {}; const createdAttributes: string[] = [];
    for (const [code, values] of [["colors", attrs.colors], ["sizes", attrs.sizes]] as Array<[string, unknown]>) {
      if (!Array.isArray(values) || !values.length) continue;
      const name = code === "colors" ? "اللون" : "المقاس";
      const [attribute] = await db.insert(productAttributes).values({ storeId, name, code: `ai_${code}`, displayType: code === "colors" ? "color" : "button", isVariantOption: true, isRequired: false, sortOrder: 0, isActive: true }).onConflictDoUpdate({ target: [productAttributes.storeId, productAttributes.code], set: { name, isVariantOption: true, isActive: true, updatedAt: now } }).returning();
      for (const value of values) await db.insert(productAttributeValues).values({ attributeId: attribute.id, value: String(value), code: String(value).replace(/\s+/g, "_").toLowerCase(), sortOrder: 0, isActive: true }).onConflictDoNothing();
      createdAttributes.push(attribute.id);
    }
    let createdVariants = 0;
    if (!existingVariants.length && Array.isArray(payload.variants) && payload.variants.length) {
      const basePrice = String(product.basePrice || "0");
      for (const [index, variant] of payload.variants.slice(0, 30).entries()) {
        await db.insert(productVariants).values({ productId: product.id, sku: `${String(payload.suggestedSku || product.productCode || "AI")}-${String(index + 1).padStart(2,"0")}`.slice(0,120), title: String(variant.title || `Variant ${index + 1}`), price: basePrice, stockQuantity: 0, lowStockThreshold: 5, attributes: variant.attributes || {}, isActive: true });
        createdVariants += 1;
      }
    }
    const [updated] = await db.update(products).set({ categoryId: payload.categoryId || product.categoryId, productCode: product.productCode || String(payload.suggestedSku || "").slice(0,120) || null, barcode: product.barcode || String(payload.suggestedInternalBarcode || "").slice(0,120) || null, updatedAt: now }).where(eq(products.id, product.id)).returning();
    if (payload.supplierId) {
      const [link] = await db.select({ id: productSuppliers.id }).from(productSuppliers).where(and(eq(productSuppliers.productId, product.id), eq(productSuppliers.supplierId, String(payload.supplierId)))).limit(1);
      if (!link) await db.insert(productSuppliers).values({ storeId, productId: product.id, supplierId: String(payload.supplierId), isPreferred: false });
    }
    executionResult = { approved: true, executed: "product_blueprint_applied", productId: updated.id, categoryId: updated.categoryId, createdAttributes, createdVariants, priceBenchmark: payload.priceBenchmark || null, barcodeKind: "internal_reference_not_gs1" };
  }
  if (before.actionType === "apply_product_copy") {
    const payload = before.payload as any; const productId = String(payload.productId || ""); const storeId = String(payload.storeId || ""); const fields = payload.fields || {};
    const [product] = await db.select().from(products).where(and(eq(products.id, productId), eq(products.storeId, storeId))).limit(1);
    if (!product) throw new Error("المنتج المقترح لتحديثه غير موجود ضمن المتجر");
    const [updated] = await db.update(products).set({ name: String(fields.name || product.name).slice(0,180), shortDescription: String(fields.shortDescription || product.shortDescription || "").slice(0,2000), description: String(fields.description || product.description || "").slice(0,10000), specifications: fields.specifications && typeof fields.specifications === "object" ? fields.specifications : product.specifications, updatedAt: now }).where(eq(products.id, product.id)).returning();
    executionResult = { approved: true, executed: "product_copy_applied", productId: updated.id, productStatusPreserved: updated.status };
  }
  const [proposal] = await db.update(aiActionProposals).set({ status: ["apply_product_copy", "apply_product_blueprint"].includes(before.actionType) ? "executed" : "approved", approvedBy: input.userId, approvedAt: now, executedAt: ["apply_product_copy", "apply_product_blueprint"].includes(before.actionType) ? now : null, executionResult, updatedAt: now }).where(eq(aiActionProposals.id, before.id)).returning();
  return { before, proposal };
}
