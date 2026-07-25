import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const checkout = readFileSync("components/checkout/multi-store-checkout.tsx", "utf8");
const orderCreate = readFileSync("app/api/orders/route.ts", "utf8");
const orderStatus = readFileSync("app/api/orders/[id]/status/route.ts", "utf8");
const inventoryCompletion = readFileSync("lib/commerce/order-inventory-completion.ts", "utf8");
const checkoutResult = readFileSync("app/checkout/result/page.tsx", "utf8");
const accountingApply = readFileSync("lib/integrations/accounting/apply.ts", "utf8");

describe("multi-store checkout safety", () => {
  it("keeps a stable per-store idempotency key and removes successful store rows during a partial checkout", () => {
    expect(checkout).toContain("checkoutAttemptsKey");
    expect(checkout).toContain("existingAttempt?.signature === signature ? existingAttempt.key");
    expect(checkout).toContain("removeSuccessfulStoreFromCart(group.storeId)");
    expect(orderCreate).toContain("shoppingCartItems");
    expect(orderCreate).toContain("A successfully created store-order consumes only that store's cart rows");
  });

  it("keeps standalone inventory reserved until paid commercial completion and restores only deducted rows on cancellation", () => {
    expect(orderCreate).not.toContain("await financialServices.inventory.finalizeOrderReservation");
    expect(orderStatus).toContain("finalizePaidDeliveredStandaloneOrder");
    expect(orderStatus).toContain("const { reserved, deducted } = await splitItemsByReservationMode");
    expect(inventoryCompletion).toContain("await financialServices.inventory.finalizeOrderReservation");
    expect(inventoryCompletion).toContain("order.reservationStatus !== \"active\"");
  });

  it("shows a payment action for each unpaid store order and does not settle ERP customer money in merchant_collects mode", () => {
    expect(checkoutResult).toContain("إتمام الدفع");
    expect(checkoutResult).toContain("/checkout/payment/${order.id}");
    expect(accountingApply).toContain("platformIsFinancialIntermediary()");
    expect(accountingApply).toContain("merchant_collects_direct_payment");
  });
});
