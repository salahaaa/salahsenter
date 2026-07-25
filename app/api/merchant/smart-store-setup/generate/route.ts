export const dynamic = "force-dynamic";

import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { generateSmartStoreSetupPlan } from "@/lib/enterprise/store-ai-setup";

const schema = z.object({
  activity: z.string().min(2),
  storeName: z.string().min(2),
  style: z.enum(["modern", "luxury", "dark", "soft", "youth", "classic"]).default("modern"),
  description: z.string().optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  includeCategories: z.boolean().default(true),
  includeProducts: z.boolean().default(true),
  includeBanners: z.boolean().default(true),
  includeAttributes: z.boolean().default(true)
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    const input = schema.parse(await request.json());
    const plan = generateSmartStoreSetupPlan({ ...input, storeName: input.storeName || store.name });
    return ok({ plan, message: "تم توليد خطة الإعداد الذكي" });
  } catch (error) {
    return handleApiError(error, "تعذر توليد الإعداد الذكي للمتجر");
  }
}
