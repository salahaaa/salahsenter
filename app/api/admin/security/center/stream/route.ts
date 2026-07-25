export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { getAdminProtectionSnapshot } from "@/lib/admin/platform-protection-center";

const encoder = new TextEncoder();

function sse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  const session = await requireAuth();
  await assertAdmin(session, "security.manage");

  let closed = false;
  request.signal.addEventListener("abort", () => {
    closed = true;
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(sse("ready", { ok: true, transport: "sse", intervalMs: 10000, at: new Date().toISOString() }));
      while (!closed) {
        try {
          const snapshot = await getAdminProtectionSnapshot();
          controller.enqueue(sse("snapshot", snapshot));
        } catch (error) {
          controller.enqueue(sse("error", { message: error instanceof Error ? error.message : "تعذر قراءة لقطة المراقبة", at: new Date().toISOString() }));
        }
        await new Promise((resolve) => setTimeout(resolve, 10_000));
      }
      try {
        controller.close();
      } catch {
        // client disconnected
      }
    },
    cancel() {
      closed = true;
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
