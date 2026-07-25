export const dynamic = "force-dynamic";

import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { getCachedPublicProductComparison } from "@/lib/discovery/product-comparison";
import { checkIpRateLimit } from "@/lib/rate-limit";

const idsSchema = z.array(z.string().uuid()).min(2).max(4);

export async function GET(request: Request) {
  try {
    const rate = await checkIpRateLimit("products:compare", 60, 15 * 60 * 1000);
    if (!rate.allowed) return fail("طلبات مقارنة كثيرة، حاول لاحقًا", 429);
    const ids = idsSchema.parse((new URL(request.url).searchParams.get("ids") || "").split(",").filter(Boolean));
    return ok(await getCachedPublicProductComparison(ids));
  } catch (error) {
    return handleApiError(error, "تعذر تحميل مقارنة المنتجات");
  }
}
