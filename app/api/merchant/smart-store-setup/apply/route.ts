export const dynamic = "force-dynamic";

import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { applySmartStoreSetup } from "@/lib/enterprise/store-ai-setup";

const planSchema = z.object({ plan: z.record(z.unknown()) });

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية إعداد هذا المتجر", 403);
    const { plan } = planSchema.parse(await request.json());
    const result = await applySmartStoreSetup(store, plan as any, session.userId);
    return ok({ result, message: "تم تطبيق الإعداد الذكي على المتجر بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر تطبيق الإعداد الذكي للمتجر");
  }
}
