export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { fail, handleApiError, ok } from "@/lib/api";
import { getCronAuthorizationStatus } from "@/lib/cron/auth";
import { expireReservations } from "@/lib/integrations/accounting/reliability";

export async function GET(request: Request) {
  try {
    const auth = getCronAuthorizationStatus(request);
    if (!auth.ok) return fail(auth.message, auth.status);
    const limit = Number(new URL(request.url).searchParams.get("limit") || 50);
    return ok(await expireReservations({ limit, reason: "cron" }));
  } catch (error) {
    return handleApiError(error, "تعذر إنهاء حجوزات المخزون المنتهية");
  }
}
