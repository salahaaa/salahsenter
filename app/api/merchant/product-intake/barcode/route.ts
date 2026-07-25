export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, products } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { enrichProductDraft, getStoreCategories, parseProductTextToDraft } from "@/lib/enterprise/product-intake";

const schema = z.object({ barcode: z.string().min(4).max(120) });

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    const payload = schema.parse(await request.json());
    const [existing] = await db.select().from(products).where(eq(products.barcode, payload.barcode)).limit(1);
    if (existing) return ok({ existing, draft: null, message: "تم العثور على منتج بنفس الباركود داخل قاعدة المنصة" });
    const categories = await getStoreCategories(store.id);
    let draft = parseProductTextToDraft(`منتج باركود ${payload.barcode}`, categories);
    draft.barcode = payload.barcode;
    draft = await enrichProductDraft(store.id, draft);
    return ok({ existing: null, draft, message: "لم نجد المنتج خارجياً، تم تجهيز مسودة بالباركود للمراجعة" });
  } catch (error) {
    return handleApiError(error, "تعذر قراءة الباركود");
  }
}
