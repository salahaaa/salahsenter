import { ApiError } from "@/lib/api";
import { getPlatformSecuritySettings } from "@/lib/security-settings";
import { isPublicCommerceBlocked } from "@/lib/platform-operation-policy";

export type PublicCommerceOperation = "checkout" | "payment_initiation";

/** Applies only to customer/merchant commerce operations. Admin routes are
 * intentionally excluded so an administrator can investigate and recover. */
export async function assertPublicCommerceOperationAllowed(operation: PublicCommerceOperation) {
  const settings = await getPlatformSecuritySettings();
  if (isPublicCommerceBlocked(settings)) throw new ApiError(`العمليات التجارية (${operation}) متوقفة مؤقتاً أثناء الصيانة أو الحماية الطارئة`, 503);
}
