export const dynamic = "force-dynamic";

import { inArray } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, products } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { suggestAdBanner } from "@/lib/ai/ad-banner-suggester";
import { userHasStoreOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  campaignType: z.enum(["sponsored_products", "featured_products", "homepage_banner"]).default("homepage_banner"),
  productIds: z.array(z.string()).default([]),
  productNames: z.array(z.string()).default([]),
  objective: z.string().max(300).optional(),
  offerText: z.string().max(160).optional(),
  audience: z.string().max(240).optional(),
  tone: z.enum(["premium", "urgent", "friendly", "seasonal"]).optional()
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasStoreOperation(session.userId, store.id, "ads.manage"))) return fail("لا تملك صلاحية إعلانات المتجر", 403);

    const payload = schema.parse(await request.json());
    let productNames = payload.productNames;
    if (payload.productIds.length) {
      const rows = await db.select({ id: products.id, name: products.name, storeId: products.storeId }).from(products).where(inArray(products.id, payload.productIds));
      if (rows.some((product) => product.storeId !== store.id)) return fail("كل المنتجات المختارة يجب أن تكون تابعة لمتجرك", 422);
      productNames = rows.map((product) => product.name);
    }

    const suggestion = suggestAdBanner({
      storeName: store.name,
      campaignType: payload.campaignType,
      productNames,
      objective: payload.objective,
      offerText: payload.offerText,
      audience: payload.audience,
      tone: payload.tone
    });

    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "merchant_ai_ad_banner_suggestion", entityId: store.id, afterData: { payload, suggestion } });
    return ok({ suggestion, message: "تم تجهيز فكرة البنر الإعلاني" });
  } catch (error) {
    return handleApiError(error, "تعذر تجهيز البنر الإعلاني بالذكاء الذكي");
  }
}
