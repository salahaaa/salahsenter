import { and, eq } from "drizzle-orm";
import { cachedAdvancedSearch } from "@/lib/search/cache";
import { generateAiText } from "@/lib/ai/gateway";
import { aiActionProposals, aiLogs, db, merchantApplicationArchives, merchantApplicationDocumentRequirements, merchantApplications, orders, stores } from "@/lib/db";
import { getStoreLaunchReadiness } from "@/lib/onboarding/store-launch-readiness";

function expires() { return new Date(Date.now() + 24 * 60 * 60 * 1000); }

export async function buildOnboardingAiReview(input: { applicationId: string; adminId: string }) {
  const [application] = await db.select().from(merchantApplications).where(eq(merchantApplications.id, input.applicationId)).limit(1);
  if (!application) throw new Error("طلب المتجر غير موجود");
  const [requirements, archives] = await Promise.all([
    db.select().from(merchantApplicationDocumentRequirements).where(eq(merchantApplicationDocumentRequirements.applicationId, application.id)),
    db.select().from(merchantApplicationArchives).where(eq(merchantApplicationArchives.applicationId, application.id))
  ]);
  const missing = requirements.filter((item) => item.isRequired && !["approved", "waived"].includes(item.status));
  const contractReady = archives.some((item) => item.kind === "signed_contract_pdf" && item.status === "ready");
  const fallback = [`حالة الطلب: ${application.status}.`, `الوثائق الإلزامية غير المحسومة: ${missing.length}.`, `أرشيف PDF للعقد الموقّع: ${contractReady ? "جاهز" : "غير جاهز"}.`, missing.length ? "التوصية: لا تنتقل للقبول المبدئي قبل اعتماد أو إعفاء الوثائق المطلوبة." : "التوصية: راجع البيانات والنموذج المالي ثم انتقل للخطوة الإدارية التالية فقط."].join("\n");
  const generated = await generateAiText({ system: "أنت مساعد مراجعة إدارية. لا توافق ولا ترفض الطلب؛ قدم قائمة evidence قصيرة فقط.", prompt: `طلب فتح متجر، الحالة ${application.status}، عدد الوثائق غير المحسومة ${missing.length}، أرشيف عقد ${contractReady}`, fallback });
  const [proposal] = await db.transaction(async (tx) => {
    await tx.insert(aiLogs).values({ userId: input.adminId, role: "assistant", prompt: `onboarding_review:${application.id}`, response: generated.text, metadata: { provider: generated.provider, external: generated.external, safeCounts: { missingDocuments: missing.length, contractArchiveReady: contractReady } } });
    return tx.insert(aiActionProposals).values({ userId: input.adminId, audience: "admin", taskType: "onboarding_review", title: `مراجعة AI لطلب ${application.storeName}`, description: "اقتراح مراجعة لا يغير حالة الطلب. افتح workflow الإداري للتحقق واتخاذ القرار.", actionType: "open_admin_workflow", payload: { href: `/admin/merchant-applications/${application.id}`, missingRequirementIds: missing.map((item) => item.id) }, riskLevel: "medium", status: "pending_approval", provider: generated.provider, model: generated.model, expiresAt: expires() }).returning();
  });
  return { analysis: generated, proposal, evidence: { missingDocuments: missing.map((item) => ({ title: item.title, status: item.status })), contractArchiveReady: contractReady } };
}

export async function buildLaunchAiReview(input: { storeId: string; adminId: string }) {
  const readiness = await getStoreLaunchReadiness(input.storeId);
  const missing = readiness.checks.filter((check) => check.critical && !check.ok);
  const fallback = missing.length ? `المتجر لا يحقق ${missing.length} من الشروط الإلزامية: ${missing.map((check) => check.label).join("، ")}. لا تنشره قبل إكمالها.` : "جميع شروط الإطلاق الإلزامية متحققة. راجع يدويًا الهوية والمحتوى ثم اعتمد الإطلاق من المسار الرسمي.";
  const generated = await generateAiText({ system: "أنت مساعد quality gate. لا تنشر متجراً ولا تتجاوز checklist.", prompt: `عدد شروط الإطلاق غير المكتملة: ${missing.length}`, fallback });
  const [proposal] = await db.transaction(async (tx) => {
    await tx.insert(aiLogs).values({ storeId: input.storeId, userId: input.adminId, role: "assistant", prompt: `launch_review:${input.storeId}`, response: generated.text, metadata: { provider: generated.provider, external: generated.external, missingChecks: missing.map((item) => item.key) } });
    return tx.insert(aiActionProposals).values({ userId: input.adminId, storeId: input.storeId, audience: "admin", taskType: "launch_review", title: "مراجعة جودة إطلاق متجر", description: "لا يوافق AI على النشر؛ يوجهك إلى checklist الرسمي.", actionType: "open_admin_workflow", payload: { href: "/admin/store-launch-readiness", missingChecks: missing.map((item) => item.key) }, riskLevel: "high", status: "pending_approval", provider: generated.provider, model: generated.model, expiresAt: expires() }).returning();
  });
  return { analysis: generated, proposal, checks: readiness.checks };
}

export async function createOrderReplyDraft(input: { userId: string; storeId: string; orderId: string; tone: string }) {
  const [order] = await db.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.storeId, input.storeId))).limit(1);
  if (!order) throw new Error("الطلب غير موجود ضمن المتجر");
  const fallback = `مرحباً، بخصوص طلبك رقم ${order.orderNumber}: حالته الحالية ${order.statusCode}. سنواصل تحديثك عبر المنصة عند أي تغيير. شكراً لتسوقك معنا.`;
  const generated = await generateAiText({ system: "أنت تكتب مسودة رد خدمة عملاء عربية. لا تؤكد وقت توصيل أو دفع أو تعويض غير موجود في بيانات الطلب.", prompt: `اكتب رداً بأسلوب ${input.tone} لطلب بحالة ${order.statusCode} فقط.`, fallback });
  const [proposal] = await db.transaction(async (tx) => {
    await tx.insert(aiLogs).values({ storeId: input.storeId, userId: input.userId, role: "assistant", prompt: `order_reply:${order.id}`, response: generated.text, metadata: { provider: generated.provider, external: generated.external } });
    return tx.insert(aiActionProposals).values({ userId: input.userId, storeId: input.storeId, audience: "merchant", taskType: "customer_reply", title: `مسودة رد للطلب ${order.orderNumber}`, description: "مسودة فقط؛ لا ترسل تلقائياً للعميل.", actionType: "copy_customer_reply", payload: { orderId: order.id, draft: generated.text }, riskLevel: "low", status: "pending_approval", provider: generated.provider, model: generated.model, expiresAt: expires() }).returning();
  });
  return { draft: generated, proposal };
}

export async function planCustomerShopping(query: string) {
  const results = await cachedAdvancedSearch({ query, limit: 6, source: "ai_shopping_planner" });
  const fallback = results.products.length ? `وجدت ${results.products.length} منتجات مطابقة تقريباً. راجع السعر والمخزون وسياسة الشحن من صفحة المنتج قبل الشراء.` : "لم أجد نتائج دقيقة. جرب إضافة العلامة أو الفئة أو الميزانية إلى البحث.";
  const generated = await generateAiText({ system: "أنت مساعد تسوق. لا تخترع منتجاً أو سعراً أو مخزوناً. استخدم النتائج الفعلية فقط.", prompt: `استعلام العميل: ${query}. عدد المنتجات المطابقة: ${results.products.length}.`, fallback });
  return { answer: generated, products: results.products, stores: results.stores, suggestions: results.suggestions };
}
