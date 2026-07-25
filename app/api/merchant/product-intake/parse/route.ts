export const dynamic = "force-dynamic";

import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { enrichProductDraft, getStoreCategories, parseProductTextToDraft } from "@/lib/enterprise/product-intake";

const schema = z.object({ text: z.string().min(2).max(1200) });

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    const payload = schema.parse(await request.json());
    const categories = await getStoreCategories(store.id);
    const draft = await enrichProductDraft(store.id, parseProductTextToDraft(payload.text, categories));
    return ok({ draft, message: "تم تحليل النص وتوليد مسودة منتج" });
  } catch (error) {
    return handleApiError(error, "تعذر تحليل المنتج الذكي");
  }
}
