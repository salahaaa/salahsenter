export const dynamic = "force-dynamic";

import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { buildMerchantAiInsights, answerMerchantQuestion, generateProductCopy, persistMerchantAiChat, saveRecommendations } from "@/lib/enterprise/merchant-ai";

const schema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("chat"), question: z.string().min(2).max(1000) }),
  z.object({ mode: z.literal("product_copy"), baseName: z.string().min(2), category: z.string().optional(), features: z.string().optional(), audience: z.string().optional(), tone: z.string().optional() }),
  z.object({ mode: z.literal("save_recommendations") })
]);

export async function GET() {
  try {
    const session = await requireAuth();
    const insights = await buildMerchantAiInsights(session.userId);
    return ok(insights);
  } catch (error) {
    return handleApiError(error, "تعذر تحميل مساعد التاجر الذكي");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const insights = await buildMerchantAiInsights(session.userId);
    if (!insights.store) return fail("لا يوجد متجر مرتبط بالحساب", 403);

    if (payload.mode === "chat") {
      const answer = answerMerchantQuestion(payload.question, insights);
      const conversation = await persistMerchantAiChat(session.userId, payload.question, answer);
      return ok({ answer, conversation, recommendations: insights.recommendations });
    }

    if (payload.mode === "product_copy") {
      const copy = generateProductCopy(payload);
      return ok({ copy, message: "تم توليد محتوى المنتج" });
    }

    const saved = await saveRecommendations(insights.store.id, insights.recommendations);
    return ok({ recommendations: saved, message: "تم حفظ التوصيات في سجل الذكاء الاصطناعي" });
  } catch (error) {
    return handleApiError(error, "تعذر تنفيذ طلب مساعد التاجر الذكي");
  }
}
