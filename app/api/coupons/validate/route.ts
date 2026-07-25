export const dynamic = "force-dynamic";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { validateCoupon } from "@/lib/coupons";

const schema = z.object({ code: z.string(), storeId: z.string().uuid(), subtotal: z.coerce.number().min(0) });

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const result = await validateCoupon({ code: payload.code, storeId: payload.storeId, userId: session.userId, subtotal: payload.subtotal });
    return ok(result);
  } catch (error) {
    return handleApiError(error, "تعذر التحقق من الكوبون");
  }
}
