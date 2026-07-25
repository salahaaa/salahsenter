export const dynamic = "force-dynamic";

import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { checkIpRateLimit } from "@/lib/rate-limit";
import { getCachedProductDiscovery } from "@/lib/discovery/product-discovery";

/** Public, explainable recommendations and cross-store alternatives for a product. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const rate = await checkIpRateLimit("product:discovery", 90, 15 * 60 * 1000);
    if (!rate.allowed) return fail("طلبات اقتراحات كثيرة، حاول لاحقًا", 429);
    const { id } = z.object({ id: z.string().uuid() }).parse(await context.params);
    const discovery = await getCachedProductDiscovery(id);
    return ok(discovery);
  } catch (error) {
    return handleApiError(error, "تعذر تحميل المنتجات والمحلات المشابهة");
  }
}
