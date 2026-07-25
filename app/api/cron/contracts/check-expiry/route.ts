export const dynamic = "force-dynamic";

import { fail, handleApiError, ok } from "@/lib/api";
import { scanContractsForExpiry } from "@/lib/contract-actions";
import { getCronAuthorizationStatus } from "@/lib/cron/auth";

export async function GET(request: Request) {
  try {
    const auth = getCronAuthorizationStatus(request);
    if (!auth.ok) return fail(auth.message, auth.status);
    const alerts = await scanContractsForExpiry(null);
    return ok({ alerts, message: "Contract expiry scan completed" });
  } catch (error) {
    return handleApiError(error, "Contract expiry scan failed");
  }
}
