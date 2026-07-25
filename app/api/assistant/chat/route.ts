export const dynamic = "force-dynamic";
export const revalidate = 0;

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { enforceRouteRateLimit } from "@/lib/rate-limit-policy";
import { mergeChatContext, smartSearch, type SmartSearchFilters } from "@/lib/smart-search";
import { cachedAdvancedSearch } from "@/lib/search/cache";
import { buildSearchFallback } from "@/lib/search/fallback";

const contextSchema = z.object({
  query: z.string().optional(),
  filters: z.object({
    minPriceBase: z.number().nullable().optional(),
    maxPriceBase: z.number().nullable().optional(),
    colors: z.array(z.string()).optional(),
    gender: z.string().nullable().optional(),
    style: z.string().nullable().optional(),
    sort: z.enum(["relevance", "price_asc", "rating_desc", "popular"]).nullable().optional()
  }).optional()
}).nullable().optional();

const requestSchema = z.object({
  message: z.string().min(1).max(500),
  context: contextSchema
});

type AssistantIntent =
  | "greeting"
  | "how_to_order"
  | "payment"
  | "shipping"
  | "returns"
  | "track_order"
  | "open_store"
  | "offers"
  | "store_only"
  | "product_search"
  | "fallback";

function normalize(value: string) {
  return value.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
}

function detectIntent(message: string): AssistantIntent {
  const text = normalize(message);
  if (/^(مرحبا|السلام|هلا|اهلا|اهلين|صباح|مساء)\b/.test(text)) return "greeting";
  if (/كيف\s*(اشتري|اطلب|اضيف|اكمل)|طريقة\s*(الشراء|الطلب)|كيف\s*استخدم\s*السله/.test(text)) return "how_to_order";
  if (/دفع|الدفع|تحويل|حواله|بطاقه|كاش|عند الاستلام|cod/.test(text)) return "payment";
  if (/شحن|توصيل|التوصيل|كم يوصل|متى يوصل|مندوب/.test(text)) return "shipping";
  if (/ارجاع|استرجاع|استرداد|مرتجع|بدل|الغاء طلب|الغاء الطلب/.test(text)) return "returns";
  if (/تتبع|تتبع طلبي|رقم الطلب|اين طلبي|وين طلبي|حالة الطلب/.test(text)) return "track_order";
  if (/افتح متجر|فتح متجر|اصير تاجر|اضيف متجر|تسجيل تاجر|اشتراك تاجر/.test(text)) return "open_store";
  if (/عروض|خصم|تخفيض|رمضان|باقة|باقه/.test(text)) return "offers";
  if (/المتاجر فقط|اعرض المتاجر|محلات|متاجر/.test(text) && !/منتج|سعر|اشتري/.test(text)) return "store_only";
  if (/ابحث|اريد|ابي|احتاج|عندي|وين الاقي|هل يوجد|منتج|سعر|لون|مقاس|ارخص|افضل/.test(text)) return "product_search";
  return "fallback";
}

function answerForIntent(intent: AssistantIntent) {
  switch (intent) {
    case "greeting":
      return "أهلاً بك 👋 أنا مساعد التسوق. أستطيع مساعدتك في البحث عن منتج، معرفة طريقة الطلب، الدفع، الشحن، الإرجاع، أو تتبع الطلب.";
    case "how_to_order":
      return "لإتمام الشراء: ابحث عن المنتج أو افتح المتجر، أضف المنتج للسلة، ثم افتح السلة أو صفحة checkout، اختر الشحن والدفع، ثم أكد الطلب. إذا كان لديك أكثر من متجر في السلة سيتم فصل الطلبات حسب كل متجر.";
    case "payment":
      return "طرق الدفع تظهر في checkout حسب إعدادات كل متجر. قد تجد دفع عند الاستلام، تحويل بنكي، حوالة، محفظة أو بوابة دفع. إذا اخترت تحويل/حوالة يمكنك رفع إثبات الدفع من صفحة الطلب.";
    case "shipping":
      return "خيارات الشحن تختلف حسب المتجر. في checkout اختر طريقة الشحن المتاحة، وبعد تحديث التاجر للشحنة يظهر رقم التتبع في تفاصيل الطلب والتنبيهات.";
    case "returns":
      return "يمكن فتح طلب إرجاع من تفاصيل الطلب بعد التسليم حسب سياسة المتجر. النظام يحفظ الفاتورة ومواصفات المنتج وقت الطلب لتسهيل المراجعة والنزاعات.";
    case "track_order":
      return "يمكنك تتبع الطلب من صفحة «تتبع الطلب» عبر رقم الطلب وبيانات التحقق، أو من صفحة طلباتي إذا كنت مسجلاً الدخول.";
    case "open_store":
      return "لفتح متجر اضغط «افتح متجرك» من الهيدر أو صفحة التسجيل، املأ بيانات النشاط والموقع والمستندات، ثم وقّع العقد الإلكتروني وانتظر موافقة الإدارة.";
    case "offers":
      return "تستطيع تصفح العروض من صفحة العروض. توجد عروض متاجر وعروض إدارة، وبعض العروض تكون باقات مجمعة مثل التموين الرمضاني. أخبرني بنوع المنتج أو الباقة لأبحث لك عنها.";
    case "store_only":
      return "سأبحث لك عن المتاجر المناسبة. اكتب نوع النشاط أو الجناح مثل: إلكترونيات، أزياء، أدوات منزلية، مواد غذائية.";
    default:
      return "أستطيع الإجابة عن طريقة الشراء والدفع والشحن والإرجاع وتتبع الطلب وفتح متجر. وإذا كنت تبحث عن منتج، اكتب اسمه أو وصفه أو السعر/اللون/المقاس المطلوب.";
  }
}

export async function POST(request: Request) {
  try {
    await enforceRouteRateLimit("/api/assistant/chat", "POST");
    const payload = requestSchema.parse(await request.json());
    const intent = detectIntent(payload.message);
    const nextContext = mergeChatContext(payload.message, payload.context as { query?: string; filters?: SmartSearchFilters } | null | undefined);

    const informational = ["greeting", "how_to_order", "payment", "shipping", "returns", "track_order", "open_store"].includes(intent);
    if (informational) {
      return ok({
        answer: answerForIntent(intent),
        context: nextContext,
        search: buildSearchFallback(payload.message, { engine: "assistant-info", products: [], stores: [], wings: [], categories: [] }),
        suggestions: buildIntentSuggestions(intent)
      });
    }

    let result: Awaited<ReturnType<typeof smartSearch>>;
    try {
      const advanced = await cachedAdvancedSearch({ query: nextContext.query, limit: 8, source: "assistant_chat" });
      result = advanced;
    } catch (error) {
      console.error("assistant search degraded", error);
      result = buildSearchFallback(nextContext.query, { engine: "assistant-degraded" }) as Awaited<ReturnType<typeof smartSearch>>;
    }

    const answer = buildAssistantAnswer({
      intent,
      result,
      originalMessage: payload.message,
      correctedQuery: result.correctedQuery && result.correctedQuery !== payload.message.trim() ? result.correctedQuery : null,
      hasFilters: Boolean(nextContext.filters.maxPriceBase || nextContext.filters.minPriceBase || nextContext.filters.colors?.length)
    });

    return ok({
      answer,
      context: nextContext,
      search: result,
      suggestions: buildFollowUpSuggestions(result, intent)
    });
  } catch (error) {
    return handleApiError(error, "تعذر تشغيل مساعد التسوق الذكي");
  }
}

function buildAssistantAnswer({ intent, result, originalMessage, correctedQuery, hasFilters }: { intent: AssistantIntent; result: Awaited<ReturnType<typeof smartSearch>>; originalMessage: string; correctedQuery: string | null; hasFilters: boolean }) {
  const productsCount = result.products.length;
  const storesCount = result.stores.length;
  const wingsCount = result.wings.length;
  if (productsCount > 0) {
    const top = result.products.slice(0, 3).map((product) => `• ${product.name} من ${product.storeName}${product.price ? ` بسعر ${product.price}` : ""}`).join("\n");
    const correction = correctedQuery ? `\nفهمت طلبك على أنه: «${correctedQuery}».` : "";
    const filters = hasFilters ? "\nطبقت الفلاتر التي ذكرتها داخل المحادثة." : "";
    return `وجدت ${productsCount} نتيجة مناسبة. أفضل الترشيحات:\n${top}${correction}${filters}\nيمكنك فتح المنتج من البطاقة أو طلب الأرخص/الأعلى تقييماً.`;
  }
  if (intent === "store_only" && storesCount > 0) {
    return `وجدت ${storesCount} متجر مناسب. افتح بطاقة المتجر لاستعراض منتجاته، أو اكتب نوع المنتج الذي تريده لأرشح لك منتجات مباشرة.`;
  }
  if (storesCount > 0 || wingsCount > 0 || result.categories.length > 0) {
    return `لم أجد منتجاً مطابقاً بدقة لـ «${originalMessage}»، لكن وجدت ${storesCount} متجر و${wingsCount} جناح و${result.categories.length} قسم قد يساعدك. جرّب كتابة اسم المنتج أو الصنف بشكل أدق.`;
  }
  return `${answerForIntent("fallback")} لم أجد نتائج دقيقة لـ «${originalMessage}». جرّب ذكر النوع، السعر، اللون أو المقاس.`;
}

function buildIntentSuggestions(intent: AssistantIntent) {
  const common = ["ابحث عن عروض اليوم", "أريد منتجاً بسعر مناسب", "تتبع طلبي", "كيف أفتح متجر؟"];
  if (intent === "payment") return ["كيف أرفع إثبات الدفع؟", "هل يوجد دفع عند الاستلام؟", ...common].slice(0, 6);
  if (intent === "shipping") return ["كيف أتتبع الشحنة؟", "كم مدة التوصيل؟", ...common].slice(0, 6);
  if (intent === "returns") return ["كيف أفتح طلب إرجاع؟", "أين أجد الفاتورة؟", ...common].slice(0, 6);
  return common;
}

function buildFollowUpSuggestions(result: Awaited<ReturnType<typeof smartSearch>>, intent: AssistantIntent) {
  const base = ["اعرض الأرخص أولاً", "أريد الأعلى تقييماً", "بسعر أقل", "اعرض المتاجر فقط"];
  if (intent === "offers") return ["عروض المواد الغذائية", "عروض رمضان", "باقات مجمعة", ...base].slice(0, 6);
  const categorySuggestions = result.categories.slice(0, 2).map((category) => `منتجات ${category.name}`);
  const semantic = result.intent.semanticLabels.map((label) => `${label} الأعلى تقييماً`);
  return [...categorySuggestions, ...semantic, ...base].slice(0, 6);
}
