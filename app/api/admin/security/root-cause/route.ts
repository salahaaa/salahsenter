export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { analyzeRootCause, deploymentMetadata } from "@/lib/ai/security-root-cause";
import { writeStructuredLog } from "@/lib/admin/platform-protection-center";

const schema = z.object({
  service: z.string().optional(),
  title: z.string().optional(),
  message: z.string().optional(),
  stackTrace: z.string().optional(),
  logs: z.array(z.string()).optional(),
  relatedServices: z.array(z.string()).optional()
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "security.manage");
    const payload = schema.parse(await request.json());
    const analysis = analyzeRootCause({ ...payload, deployment: deploymentMetadata() });
    await writeStructuredLog({ level: analysis.severity === "critical" ? "critical" : "warn", category: "root_cause", service: analysis.affectedService, message: analysis.likelyCause, actorId: session.userId, metadata: analysis as unknown as Record<string, unknown> });
    return ok({ analysis, message: "تم تحليل السبب الجذري" });
  } catch (error) {
    return handleApiError(error, "تعذر تحليل السبب الجذري");
  }
}
