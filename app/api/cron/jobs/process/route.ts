export const dynamic = "force-dynamic";

import { fail, handleApiError, ok } from "@/lib/api";
import { getCronAuthorizationStatus } from "@/lib/cron/auth";
import { processDueJobs } from "@/lib/queue/processor";

export async function GET(request: Request) {
  try {
    const auth = getCronAuthorizationStatus(request);
    if (!auth.ok) return fail(auth.message, auth.status);
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") || 25);
    const queue = url.searchParams.get("queue") || "default";
    const summary = await processDueJobs({ limit, queue });
    return ok({ summary, message: "Background jobs processed" });
  } catch (error) {
    return handleApiError(error, "Background job processing failed");
  }
}

export async function POST(request: Request) {
  return GET(request);
}
