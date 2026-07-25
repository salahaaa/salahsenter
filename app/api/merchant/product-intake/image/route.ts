export const dynamic = "force-dynamic";

import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { enrichProductDraft, getStoreCategories, parseProductTextToDraft } from "@/lib/enterprise/product-intake";

const schema = z.object({ imageUrl: z.string().min(5), fileName: z.string().optional(), hint: z.string().optional() });

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    const payload = schema.parse(await request.json());
    const categories = await getStoreCategories(store.id);
    const text = [payload.hint, payload.fileName?.replace(/[-_\.]/g, " ")].filter(Boolean).join(" ") || "منتج جديد";
    let draft = parseProductTextToDraft(text, categories);
    draft.mainImageUrl = payload.imageUrl;
    draft.variants = (draft.variants || []).map((variant) => ({ ...variant, imageUrl: payload.imageUrl, images: [payload.imageUrl] }));
    draft.description = draft.description || "";
    draft = await enrichProductDraft(store.id, draft);
    return ok({ draft, message: "تم تحليل الصورة مبدئياً وتوليد مسودة منتج" });
  } catch (error) {
    return handleApiError(error, "تعذر تحليل الصورة");
  }
}
