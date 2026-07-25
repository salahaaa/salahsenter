export const dynamic = "force-dynamic";

import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getMerchantRentalBilling } from "@/lib/rentals/service";

export async function GET() {
  try {
    const session = await requireAuth();
    return ok(await getMerchantRentalBilling(session.userId));
  } catch (error) {
    return handleApiError(error, "تعذر تحميل فواتير الإيجار والإضافات");
  }
}
