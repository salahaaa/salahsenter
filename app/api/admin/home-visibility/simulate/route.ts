export const dynamic = "force-dynamic";

import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { assertAdmin } from "@/lib/rbac";
import { simulateHomeVisibility } from "@/lib/home-visibility-simulator";

const schema = z.object({ type: z.enum(["store", "product", "offer", "wing"]), id: z.string().min(1) });

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "home.manage");
    const url = new URL(request.url);
    const parsed = schema.safeParse({ type: url.searchParams.get("type"), id: url.searchParams.get("id") });
    if (!parsed.success) return fail("حدد type و id للمحاكاة", 422);
    return ok(await simulateHomeVisibility(parsed.data));
  } catch (error) {
    return handleApiError(error, "تعذر تشغيل محاكي الظهور");
  }
}
