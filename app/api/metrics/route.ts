export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getCentralMonitoringSnapshot, renderPrometheusMetrics } from "@/lib/observability/central-monitoring";
import { isStrictProductionLaunch } from "@/lib/production/launch-mode";

function authorized(request: Request) {
  const token = process.env.METRICS_TOKEN || "";
  if (!token) return !isStrictProductionLaunch();
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const queryToken = new URL(request.url).searchParams.get("token") || "";
  return bearer === token || queryToken === token;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return new Response("metrics endpoint unauthorized or METRICS_TOKEN missing in production\n", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const snapshot = await getCentralMonitoringSnapshot();
  return new Response(renderPrometheusMetrics(snapshot), {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
