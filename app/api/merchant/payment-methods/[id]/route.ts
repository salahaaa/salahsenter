export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, merchantFinancialProviderAccounts, paymentMethods } from "@/lib/db";
import { userHasStoreOperation } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { assertMerchantProviderAllowed, providerPaymentCode } from "@/lib/financial/providers";
import { paymentInstructionConfigSchema, toPaymentMethodClientDto } from "@/lib/payments/config";

const schema = z.object({
  financialProviderId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(140).optional(),
  description: z.string().trim().max(2_000).optional(),
  config: paymentInstructionConfigSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional()
});

async function assertOwned(session: Awaited<ReturnType<typeof requireAuth>>, id: string) {
  const [method] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, id)).limit(1);
  if (!method) return { error: fail("وسيلة الدفع غير موجودة", 404) };
  if (!method.storeId) return { error: fail("لا يمكن تعديل وسيلة دفع عامة من لوحة المتجر", 403) };
  if (!hasStoreAccess(session, method.storeId)) return { error: fail("لا تملك الصلاحية", 403) };
  if (!(await userHasStoreOperation(session.userId, method.storeId, "payments.manage"))) return { error: fail("لا تملك صلاحية إعدادات المتجر", 403) };
  return { method };
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const access = await assertOwned(session, id);
    if (access.error) return access.error;
    const before = access.method!;
    const patch: Record<string, unknown> = { ...payload, updatedAt: new Date() };

    if (payload.financialProviderId) {
      const provider = await assertMerchantProviderAllowed(payload.financialProviderId);
      if (provider.type === "gateway") return fail("تكاملات بوابات الدفع تُدار من إعدادات الخادم ولا يمكن للتاجر إدخال URLs أو مفاتيح لها", 403);
      patch.financialProviderId = provider.id;
      patch.name = payload.name || provider.name;
      patch.provider = providerPaymentCode(provider);
    }

    if (payload.config && before.merchantFinancialAccountId) {
      await db
        .update(merchantFinancialProviderAccounts)
        .set({ config: payload.config, accountNumber: payload.config.accountNumber || null, walletNumber: payload.config.walletNumber || null, beneficiaryName: payload.config.accountName || payload.config.recipientName || null, iban: payload.config.iban || null, branchName: payload.config.bankName || payload.config.exchangeCompany || null, updatedAt: new Date() })
        .where(eq(merchantFinancialProviderAccounts.id, before.merchantFinancialAccountId));
    }

    if (payload.financialProviderId && before.merchantFinancialAccountId) {
      await db.update(merchantFinancialProviderAccounts).set({ financialProviderId: payload.financialProviderId, updatedAt: new Date() }).where(eq(merchantFinancialProviderAccounts.id, before.merchantFinancialAccountId));
    }

    const [method] = await db.update(paymentMethods).set(patch).where(eq(paymentMethods.id, id)).returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "store_payment_method", entityId: id, beforeData: toPaymentMethodClientDto(before), afterData: toPaymentMethodClientDto(method) });
    return ok({ paymentMethod: toPaymentMethodClientDto(method), message: "تم تحديث وسيلة الدفع" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث وسيلة الدفع");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const access = await assertOwned(session, id);
    if (access.error) return access.error;
    await db.update(paymentMethods).set({ isActive: false, updatedAt: new Date() }).where(eq(paymentMethods.id, id));
    if (access.method?.merchantFinancialAccountId) {
      await db
        .update(merchantFinancialProviderAccounts)
        .set({ status: "disabled", updatedAt: new Date() })
        .where(eq(merchantFinancialProviderAccounts.id, access.method.merchantFinancialAccountId));
    }
    await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "store_payment_method", entityId: id, beforeData: toPaymentMethodClientDto(access.method!), afterData: { isActive: false, merchantFinancialAccountDisabled: Boolean(access.method?.merchantFinancialAccountId) } });
    return ok({ message: "تم تعطيل وسيلة الدفع وإيقاف تعامل المتجر مع هذا المزود" });
  } catch (error) {
    return handleApiError(error, "تعذر حذف وسيلة الدفع");
  }
}
