import { ApiError } from "@/lib/api";

/**
 * Commercial launch policy: orders are a direct customer↔merchant transaction.
 * `settlement` exists only as an explicit future migration mode; it is never
 * the default and must not be enabled implicitly by a feature.
 */
export function customerMoneyMode(): "merchant_collects" | "platform_settlement" {
  return process.env.PLATFORM_CUSTOMER_MONEY_MODE === "platform_settlement" ? "platform_settlement" : "merchant_collects";
}

export function platformIsFinancialIntermediary() {
  return customerMoneyMode() === "platform_settlement";
}

export function assertPlatformSettlementEnabled() {
  if (!platformIsFinancialIntermediary()) {
    throw new ApiError("وفق نموذج المنصة الحالي، العميل يدفع للتاجر مباشرة ولا تتولى المنصة رصيد التاجر أو طلبات السحب. استخدم صفحة إيرادات المنصة لسداد الإيجار والعمولة والإعلانات فقط.", 409);
  }
}
