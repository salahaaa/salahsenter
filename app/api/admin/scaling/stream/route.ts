export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { getAutoScalingSnapshot } from "@/lib/scaling/auto-scaling-intelligence";

const encoder = new TextEncoder();
function sse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  const session = await requireAuth();
  await assertAdmin(session, "security.manage");
  let closed = false;
  request.signal.addEventListener("abort", () => { closed = true; });
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(sse("ready", { ok: true, transport: "sse", websocketReady: true, intervalMs: 10000, at: new Date().toISOString() }));
      while (!closed) {
        try {
          controller.enqueue(sse("snapshot", await getAutoScalingSnapshot()));
        } catch (error) {
          controller.enqueue(sse("error", { message: error instanceof Error ? error.message : "تعذر تحديث Auto Scaling", at: new Date().toISOString() }));
        }
        await new Promise((resolve) => setTimeout(resolve, 10_000));
      }
      try { controller.close(); } catch { /* disconnected */ }
    },
    cancel() { closed = true; }
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
