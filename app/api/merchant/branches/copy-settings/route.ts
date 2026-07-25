export const dynamic = "force-dynamic";

import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { copyMainStoreSettingsToBranch } from "@/lib/enterprise/store-branches";

const schema = z.object({ branchStoreId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const copied = await copyMainStoreSettingsToBranch(session.userId, payload.branchStoreId);
    return ok({ copied, message: "تم سحب إعدادات المتجر الرئيسي إلى الفرع" });
  } catch (error) {
    return handleApiError(error, "تعذر سحب إعدادات المتجر الرئيسي");
  }
}
