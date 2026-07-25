export const dynamic = "force-dynamic";

import { handleApiError, ok } from "@/lib/api";
import { getVisibleFinancialProviders } from "@/lib/financial/providers";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const providers = await getVisibleFinancialProviders({ type, customerPaymentsOnly: true });
    return ok({ providers });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل مزودي الخدمات المالية");
  }
}
