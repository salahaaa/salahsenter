export const dynamic = "force-dynamic";

import { z } from "zod";
import { created, fail, handleApiError } from "@/lib/api";
import { getCurrentSession } from "@/lib/auth";
import { funnelEventTypes, recordFunnelEvent } from "@/lib/analytics/funnel";
import { checkIpRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  eventType: z.enum(funnelEventTypes),
  visitorId: z.string().min(12).max(160).optional(),
  storeId: z.string().uuid().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  metadata: z.object({ source: z.string().max(80).optional(), variantId: z.string().uuid().optional(), cartItems: z.number().int().min(0).max(500).optional(), originProductId: z.string().uuid().optional(), originStoreId: z.string().uuid().optional(), confidence: z.enum(["exact", "strong", "similar", "weak"]).optional() }).optional().default({})
});

/** Privacy-aware browser funnel event ingestion. No raw visitor ID is stored. */
export async function POST(request: Request) {
  try {
    const rate = await checkIpRateLimit("analytics:funnel", 180, 15 * 60 * 1000);
    if (!rate.allowed) return fail("محاولات كثيرة، حاول لاحقاً", 429);
    const payload = schema.parse(await request.json());
    const session = await getCurrentSession();
    await recordFunnelEvent({ ...payload, userId: session?.userId || null });
    return created({ recorded: true });
  } catch (error) {
    return handleApiError(error, "تعذر تسجيل حدث التحليل");
  }
}
