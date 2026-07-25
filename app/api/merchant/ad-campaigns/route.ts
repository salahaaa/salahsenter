export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { adCampaigns, db, products } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { isStoreOperational } from "@/lib/store-guards";
import { writeAuditLog } from "@/lib/audit";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";
import { notifyAdmins } from "@/lib/notifications";
import { defaultPlacementForCampaignType, isPlacementAllowedForCampaignType } from "@/lib/ads/marketplace";

const schema = z.object({
  name: z.string().min(2).max(180),
  type: z.enum(["sponsored_products", "featured_products", "homepage_banner"]),
  placementId: z.string().trim().min(3).max(80).optional(),
  billingModel: z.enum(["cpc", "cpm"]).default("cpc"),
  frequencyCap: z.coerce.number().int().min(1).max(20).default(3),
  /** Launch policy is YER; explicit schema prevents hidden currency mixing. */
  currency: z.literal("YER").default("YER"),
  budget: z.coerce.number().min(0),
  dailyBudget: z.coerce.number().min(0).default(0),
  bidAmount: z.coerce.number().min(0).default(0),
  startsAt: z.string().optional().nullable(),
  endsAt: z.string().optional().nullable(),
  productIds: z.array(z.string()).default([]),
  targetConfig: z.record(z.unknown()).default({}),
  creative: z.record(z.unknown()).default({})
});

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ campaigns: [] });
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, store.id, ["store.ads.view", Permission.ManageStoreAds, Permission.ManageAnnouncements, Permission.ManageStoreMedia, Permission.ManageStoreSettings]))) return fail("لا تملك صلاحية إعلانات المتجر", 403);
    const campaigns = await db.select().from(adCampaigns).where(eq(adCampaigns.storeId, store.id)).orderBy(desc(adCampaigns.createdAt));
    return ok({ campaigns });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل الحملات الإعلانية");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, store.id, ["store.ads.manage", Permission.ManageStoreAds, Permission.ManageAnnouncements, Permission.ManageStoreMedia, Permission.ManageStoreSettings]))) return fail("لا تملك صلاحية إنشاء إعلانات المتجر", 403);
    if (!(await isStoreOperational(store.id))) return fail("المتجر غير جاهز لتشغيل الإعلانات", 403);
    const payload = schema.parse(await request.json());
    const placementId = payload.placementId || defaultPlacementForCampaignType(payload.type);
    if (!isPlacementAllowedForCampaignType(payload.type, placementId)) return fail("موضع العرض غير صالح لنوع الحملة المحدد", 422);
    if (payload.bidAmount > 0 && payload.budget <= 0) return fail("الحملة ذات سعر CPC/CPM تتطلب ميزانية كلية أكبر من صفر", 422);
    if (payload.billingModel === "cpm" && payload.bidAmount > 0 && payload.bidAmount < 10) return fail("الحد الأدنى لسعر الألف ظهور هو 10 ريال لضمان دقة الفوترة", 422);
    if (payload.dailyBudget > 0 && payload.budget > 0 && payload.dailyBudget > payload.budget) return fail("لا يمكن أن تتجاوز الميزانية اليومية الميزانية الكلية", 422);
    if (payload.startsAt && payload.endsAt && new Date(payload.endsAt).getTime() <= new Date(payload.startsAt).getTime()) return fail("تاريخ نهاية الحملة يجب أن يكون بعد تاريخ البداية", 422);
    if (["sponsored_products", "featured_products"].includes(payload.type) && !payload.productIds.length) return fail("اختر منتجاً واحداً على الأقل للحملة الممولة", 422);
    const creativeInput = (payload.creative || {}) as Record<string, unknown>;
    const primaryVariantId = typeof creativeInput.variantId === "string" && /^[0-9a-f-]{36}$/i.test(creativeInput.variantId) ? creativeInput.variantId : crypto.randomUUID();
    const submittedVariants = Array.isArray(creativeInput.variants) ? creativeInput.variants.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)).slice(0, 2) : [];
    const creative: Record<string, unknown> = {
      ...creativeInput,
      variantId: primaryVariantId,
      variants: [
        { id: primaryVariantId, label: "A", headline: creativeInput.headline || payload.name, description: creativeInput.description || "", imageUrl: creativeInput.imageUrl || null, linkUrl: creativeInput.linkUrl || null },
        ...submittedVariants.map((variant, index) => ({ id: typeof variant.id === "string" && /^[0-9a-f-]{36}$/i.test(variant.id) ? variant.id : crypto.randomUUID(), label: typeof variant.label === "string" ? variant.label.slice(0, 24) : index === 0 ? "B" : "C", headline: typeof variant.headline === "string" ? variant.headline.slice(0, 180) : payload.name, description: typeof variant.description === "string" ? variant.description.slice(0, 1_500) : "", imageUrl: typeof variant.imageUrl === "string" ? variant.imageUrl : creativeInput.imageUrl || null, linkUrl: typeof variant.linkUrl === "string" ? variant.linkUrl : creativeInput.linkUrl || null }))
      ]
    };
    if (["homepage_banner", "category_banner"].includes(payload.type) && typeof creative.imageUrl !== "string") return fail("صورة البنر مطلوبة لإرسال إعلان بنر للمراجعة", 422);
    if (["homepage_banner", "category_banner"].includes(payload.type) && !String(creative.imageUrl || "").trim()) return fail("صورة البنر مطلوبة لإرسال إعلان بنر للمراجعة", 422);
    if (payload.productIds.length) {
      const productRows = await db.select({ id: products.id, storeId: products.storeId }).from(products).where(inArray(products.id, payload.productIds));
      if (productRows.length !== payload.productIds.length || productRows.some((product) => product.storeId !== store.id)) return fail("كل المنتجات المختارة يجب أن تكون تابعة لمتجرك", 422);
    }
    const [campaign] = await db.insert(adCampaigns).values({ ...payload, creative, placementId, storeId: store.id, createdBy: session.userId, status: "pending_review", startsAt: payload.startsAt ? new Date(payload.startsAt) : null, endsAt: payload.endsAt ? new Date(payload.endsAt) : null, budget: payload.budget.toString(), dailyBudget: payload.dailyBudget.toString(), bidAmount: payload.bidAmount.toString() }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "ad_campaign", entityId: campaign.id, afterData: campaign });
    await notifyAdmins({
      title: payload.type === "homepage_banner" ? "طلب نشر إعلان بنر رئيسي" : "طلب إعلان متجر جديد",
      body: `أرسل متجر ${store.name} طلب إعلان: ${payload.name}.`,
      type: "merchant_ad_campaign_submitted",
      data: { campaignId: campaign.id, storeId: store.id, adType: payload.type, url: "/admin/ads" }
    });
    return created({ campaign, message: "تم إرسال الحملة للمراجعة" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء الحملة الإعلانية");
  }
}
