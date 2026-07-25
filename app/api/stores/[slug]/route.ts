export const dynamic = "force-dynamic";

import { fail, handleApiError, ok } from "@/lib/api";
import { getPublicStore } from "@/lib/db/queries";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const params = await context.params;
  try {
    const store = await getPublicStore(params.slug);
    if (!store) return fail("المتجر غير موجود", 404);
    return ok(store);
  } catch (error) {
    return handleApiError(error, "تعذر تحميل المتجر");
  }
}
