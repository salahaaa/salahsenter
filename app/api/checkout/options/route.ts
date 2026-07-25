export const dynamic = "force-dynamic";

import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { fail, handleApiError, ok } from "@/lib/api";
import { assertPublicCommerceOperationAllowed } from "@/lib/platform-operation-guard";
import { db, financialProviders, paymentMethods, shippingMethods, stores, systemSettings } from "@/lib/db";
import { toPaymentMethodClientDto } from "@/lib/payments/config";
import { normalizeShippingCoverage, resolveMerchantShipping, shippingCoverageSummary } from "@/lib/shipping/coverage";
import { getCurrency, getStoreCurrencySettings } from "@/lib/currency";

const defaultOrderSettings = { autoAcceptOrders: false, allowCancellation: true, cancellationHours: 2, minOrderAmount: 0, preparationMinutes: 60, enableReservationExpiry: false, reservationExpiryMinutes: 120, returnPolicy: "", shippingPolicy: "", notes: "" };

export async function GET(request: Request) {
  try {
    await assertPublicCommerceOperationAllowed("checkout");
    const url = new URL(request.url);
    const storeIds = (url.searchParams.get("storeIds") || "").split(",").map((id) => id.trim()).filter(Boolean);
    const geo = { governorateId: url.searchParams.get("governorateId"), cityId: url.searchParams.get("cityId"), districtId: url.searchParams.get("districtId") };
    const subtotalByStore: Record<string, number> = Object.fromEntries((url.searchParams.get("subtotals") || "").split(",").map((item) => item.split(":")).filter((parts) => parts.length === 2).map(([storeId, subtotal]) => [storeId, Math.max(0, Number(subtotal || 0) || 0)]));
    if (!storeIds.length) return ok({ stores: [] });
    if (storeIds.length > 20) return fail("عدد المتاجر في الطلب كبير جداً", 422);

    const activeStores = await db
      .select({ id: stores.id, name: stores.name, slug: stores.slug, status: stores.status, isActive: stores.isActive, operationStatus: stores.operationStatus })
      .from(stores)
      .where(and(inArray(stores.id, storeIds), eq(stores.status, "active"), eq(stores.isActive, true)));

    const activeIds = activeStores.map((store) => store.id);
    if (!activeIds.length) return ok({ stores: [] });

    const [payments, shippings, settingsRows, currencySettingsRows] = await Promise.all([
      db
        .select({
          method: {
            id: paymentMethods.id,
            storeId: paymentMethods.storeId,
            financialProviderId: paymentMethods.financialProviderId,
            name: paymentMethods.name,
            code: paymentMethods.code,
            description: paymentMethods.description,
            provider: paymentMethods.provider,
            isActive: paymentMethods.isActive,
            sortOrder: paymentMethods.sortOrder
          },
          provider: {
            status: financialProviders.status,
            isEnabled: financialProviders.isEnabled,
            supportsDeposits: financialProviders.supportsDeposits
          }
        })
        .from(paymentMethods)
        .leftJoin(financialProviders, eq(paymentMethods.financialProviderId, financialProviders.id))
        .where(and(eq(paymentMethods.isActive, true), or(inArray(paymentMethods.storeId, activeIds), isNull(paymentMethods.storeId))))
        .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name)),
      db.select().from(shippingMethods).where(and(eq(shippingMethods.isActive, true), or(inArray(shippingMethods.storeId, activeIds), isNull(shippingMethods.storeId)))).orderBy(asc(shippingMethods.sortOrder), asc(shippingMethods.name)),
      db.select().from(systemSettings).where(inArray(systemSettings.group, activeIds.map((id) => `store:${id}`))),
      Promise.all(activeIds.map(async (storeId) => [storeId, await getStoreCurrencySettings(storeId)] as const))
    ]);
    const currencyByStore = new Map(currencySettingsRows.map(([storeId, settings]) => [storeId, getCurrency(settings, settings.defaultCurrency)]));

    return ok({
      stores: activeStores.map((store) => ({
        ...store,
        currency: currencyByStore.get(store.id) || { code: "YER", symbol: "YER", rateToBase: 1 },
        paymentMethods: store.operationStatus && store.operationStatus !== "OPEN"
          ? []
          : payments
            .filter((row) => (!row.method.storeId || row.method.storeId === store.id) && (!row.provider || (row.provider.status === "active" && row.provider.isEnabled && row.provider.supportsDeposits)))
            .map((row) => toPaymentMethodClientDto(row.method)),
        shippingMethods: store.operationStatus && store.operationStatus !== "OPEN"
          ? []
          : shippings
            .filter((method) => !method.storeId || method.storeId === store.id)
            .map((method) => {
              const coverage = normalizeShippingCoverage(method.coverageConfig);
              const resolution = resolveMerchantShipping({ baseFee: Number(method.fee || 0), coverage, geo, subtotal: subtotalByStore[store.id] || 0 });
              return { ...method, fee: resolution.fee.toString(), available: resolution.available, unavailableReason: resolution.reason, coverage: shippingCoverageSummary(coverage) };
            })
            .filter((method) => method.available),
        orderSettings: { ...defaultOrderSettings, ...((settingsRows.find((row) => row.group === `store:${store.id}` && row.key === "order_settings")?.value || {}) as Record<string, unknown>) }
      }))
    });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل خيارات الدفع والشحن");
  }
}
