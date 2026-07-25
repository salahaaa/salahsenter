export const dynamic = "force-dynamic";

import { asc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, merchantFinancialProviderAccounts, paymentMethods, stores } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { userHasStoreOperation } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { writeAuditLog } from "@/lib/audit";
import { assertMerchantProviderAllowed, providerPaymentCode } from "@/lib/financial/providers";
import { paymentInstructionConfigSchema, toMerchantFinancialAccountClientDto, toPaymentMethodClientDto } from "@/lib/payments/config";

const schema = z.object({
  storeId: z.string().uuid().optional(),
  financialProviderId: z.string().uuid(),
  name: z.string().trim().min(2).max(140).optional(),
  code: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2_000).optional(),
  config: paymentInstructionConfigSchema.default({}),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0)
});

async function getStoreForSession(userId: string, storeId?: string) {
  const primary = await getMerchantPrimaryStore(userId);
  return storeId || primary?.id || null;
}

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ paymentMethods: [] });
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية الوصول للمتجر", 403);
    if (!(await userHasStoreOperation(session.userId, store.id, "payments.view"))) return fail("لا تملك صلاحية عرض وسائل الدفع", 403);
    const items = await db
      .select()
      .from(paymentMethods)
      .where(or(eq(paymentMethods.storeId, store.id), isNull(paymentMethods.storeId)))
      .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name));
    return ok({ paymentMethods: items.map(toPaymentMethodClientDto) });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل وسائل دفع المتجر");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const storeId = await getStoreForSession(session.userId, payload.storeId);
    if (!storeId) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasStoreOperation(session.userId, storeId, "payments.manage"))) return fail("لا تملك صلاحية إعدادات المتجر", 403);

    const provider = await assertMerchantProviderAllowed(payload.financialProviderId);
    if (provider.type === "gateway") return fail("تكاملات بوابات الدفع تُدار من إعدادات الخادم ولا يمكن للتاجر إدخال URLs أو مفاتيح لها", 403);

    const [store] = await db.select({ merchantId: stores.merchantId }).from(stores).where(eq(stores.id, storeId)).limit(1);
    const accountConfig = payload.config;
    const [account] = await db.insert(merchantFinancialProviderAccounts).values({
      storeId,
      merchantId: store?.merchantId || session.userId,
      financialProviderId: provider.id,
      accountNumber: accountConfig.accountNumber || null,
      walletNumber: accountConfig.walletNumber || null,
      beneficiaryName: accountConfig.accountName || accountConfig.recipientName || null,
      iban: accountConfig.iban || null,
      branchName: accountConfig.bankName || accountConfig.exchangeCompany || null,
      config: accountConfig,
      status: "active"
    }).returning();
    const code = `${storeId.slice(0, 8)}_${payload.code || provider.slug || slugify(provider.name) || "payment"}`.slice(0, 120);
    const providerCode = providerPaymentCode(provider);
    const [method] = await db.insert(paymentMethods).values({
      storeId,
      financialProviderId: provider.id,
      merchantFinancialAccountId: account.id,
      name: payload.name || provider.name,
      code,
      description: payload.description || provider.name,
      provider: providerCode,
      config: accountConfig,
      isActive: payload.isActive,
      sortOrder: payload.sortOrder
    }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "store_payment_method", entityId: method.id, afterData: { method: toPaymentMethodClientDto(method), account: toMerchantFinancialAccountClientDto(account), provider: { id: provider.id, slug: provider.slug, type: provider.type } } });
    return created({ paymentMethod: toPaymentMethodClientDto(method), account: toMerchantFinancialAccountClientDto(account), message: "تم حفظ وسيلة دفع المتجر من مزود معتمد" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ وسيلة دفع المتجر");
  }
}
