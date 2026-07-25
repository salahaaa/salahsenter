export const dynamic = "force-dynamic";
import { handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { getMerchantPlatformRevenue } from "@/lib/platform-revenue/service";
export async function GET() { try { const session = await requireAuth(); return ok(await getMerchantPlatformRevenue(session.userId)); } catch (error) { return handleApiError(error, "تعذر تحميل إيرادات المنصة للتاجر"); } }
