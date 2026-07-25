export const dynamic = "force-dynamic";

import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, systemSettings } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { defaultCurrencySettings, getStoreCurrencySettings, normalizeCurrencySettings } from "@/lib/currency";
import { Permission, userHasStorePermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const currencySchema = z.object({
  code: z.string().min(2).max(8).transform((value) => value.toUpperCase()),
  name: z.string().min(2),
  symbol: z.string().min(1),
  rateToBase: z.coerce.number().positive(),
  isActive: z.boolean().default(true)
});

const settingsSchema = z.object({
  storeId: z.string().uuid().optional(),
  defaultCurrency: z.string().min(2).max(8).transform((value) => value.toUpperCase()),
  currencies: z.array(currencySchema).min(1)
});

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ settings: defaultCurrencySettings });
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية الوصول للمتجر", 403);
    return ok({ settings: await getStoreCurrencySettings(store.id), storeId: store.id });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل إعدادات العملات");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const payload = settingsSchema.parse(await request.json());
    const primary = await getMerchantPrimaryStore(session.userId);
    const storeId = payload.storeId || primary?.id;
    if (!storeId) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasStorePermission(session.userId, storeId, Permission.ManageStoreSettings))) return fail("لا تملك صلاحية إعدادات المتجر", 403);

    const settings = normalizeCurrencySettings(payload);
    const base = settings.currencies.find((currency) => currency.code === settings.defaultCurrency);
    if (!base) return fail("العملة الافتراضية يجب أن تكون ضمن قائمة العملات", 422);
    settings.currencies = settings.currencies.map((currency) => currency.code === settings.defaultCurrency ? { ...currency, rateToBase: 1, isActive: true } : currency);

    const [setting] = await db
      .insert(systemSettings)
      .values({ group: `store:${storeId}`, key: "currency_settings", value: settings, isPublic: true, updatedBy: session.userId })
      .onConflictDoUpdate({
        target: [systemSettings.group, systemSettings.key],
        set: { value: settings, isPublic: true, updatedBy: session.userId, updatedAt: new Date() }
      })
      .returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "store_currency_settings", entityId: storeId, afterData: setting });
    return ok({ settings, message: "تم حفظ إعدادات العملات بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ إعدادات العملات");
  }
}
