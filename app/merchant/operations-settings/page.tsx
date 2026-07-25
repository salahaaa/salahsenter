import Link from "next/link";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { OperationsSettingsPanel } from "@/components/merchant/operations-settings-panel";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAuth } from "@/lib/auth";
import { db, financialProviders, governorates, paymentMethods, shippingMethods, systemSettings } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { toPaymentMethodClientDto } from "@/lib/payments/config";

const defaultOrderSettings = { autoAcceptOrders: false, allowCancellation: true, cancellationHours: 2, minOrderAmount: 0, preparationMinutes: 60, enableReservationExpiry: false, reservationExpiryMinutes: 120, returnPolicy: "", shippingPolicy: "", notes: "" };
const defaultIntegrationSettings = { integrationEnabled: false, integrationMode: "STANDALONE" as const, erpProvider: "none" };

export default async function MerchantOperationsSettingsPage() {
  const session = await requireAuth();
  const store = await getMerchantPrimaryStore(session.userId);
  const [paymentRows, shippings, orderSettingRows, integrationSettingRows, providerRows, governorateRows] = store
    ? await Promise.all([
        db.select({ id: paymentMethods.id, storeId: paymentMethods.storeId, financialProviderId: paymentMethods.financialProviderId, name: paymentMethods.name, code: paymentMethods.code, description: paymentMethods.description, provider: paymentMethods.provider, isActive: paymentMethods.isActive, sortOrder: paymentMethods.sortOrder }).from(paymentMethods).where(or(eq(paymentMethods.storeId, store.id), isNull(paymentMethods.storeId))).orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name)),

        db.select().from(shippingMethods).where(or(eq(shippingMethods.storeId, store.id), isNull(shippingMethods.storeId))).orderBy(asc(shippingMethods.sortOrder), asc(shippingMethods.name)),
        db.select().from(systemSettings).where(and(eq(systemSettings.group, `store:${store.id}`), eq(systemSettings.key, "order_settings"))).limit(1),
        db.select().from(systemSettings).where(and(eq(systemSettings.group, `store:${store.id}`), eq(systemSettings.key, "integration_settings"))).limit(1),
        db.select().from(financialProviders).where(and(eq(financialProviders.status, "active"), eq(financialProviders.isEnabled, true), eq(financialProviders.isVisibleToMerchants, true))).orderBy(asc(financialProviders.sortOrder), asc(financialProviders.name)),
        db.select({ id: governorates.id, name: governorates.name }).from(governorates).where(eq(governorates.isActive, true)).orderBy(asc(governorates.sortOrder), asc(governorates.name))
      ])
    : [[], [], [], [], [], []];
  const orderSettings = { ...defaultOrderSettings, ...((orderSettingRows[0]?.value || {}) as Record<string, unknown>) } as typeof defaultOrderSettings;
  const integrationSettings = { ...defaultIntegrationSettings, ...((integrationSettingRows[0]?.value || {}) as Record<string, unknown>) } as typeof defaultIntegrationSettings;
  const payments = paymentRows.map(toPaymentMethodClientDto);

  return <main className="min-h-screen merchant-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-black text-slate-950">الدفع والشحن والطلبات</h1><p className="mt-2 text-sm text-slate-500">هذه الإعدادات تخص المتجر، لذلك يديرها التاجر من لوحة المتجر وليس الأدمن.</p></div><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div>{!store?<EmptyState title="لا يوجد متجر"/>:<OperationsSettingsPanel storeId={store.id} payments={payments} shippings={shippings} financialProviders={providerRows} governorates={governorateRows} orderSettings={orderSettings} integrationSettings={integrationSettings} operationSettings={{ operationStatus: store.operationStatus || "OPEN", operationNote: store.operationNote || "", businessHours: store.businessHours || {} }}/>}</section></main>
}
