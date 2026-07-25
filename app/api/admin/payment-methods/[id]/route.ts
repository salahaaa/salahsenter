export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, paymentMethods } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { paymentInstructionConfigSchema, toPaymentMethodClientDto } from "@/lib/payments/config";

const providerSchema = z.enum(["manual", "cod", "bank_transfer", "wallet", "remittance", "local_gateway", "stripe"]);
const schema = z.object({
  name: z.string().trim().min(2).max(140).optional(),
  code: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2_000).optional(),
  provider: providerSchema.optional(),
  config: paymentInstructionConfigSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await requireAuth();
    await assertAdmin(session, "payments.manage");
    const payload = schema.parse(await request.json());
    const [before] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, params.id)).limit(1);
    if (!before) return fail("وسيلة الدفع غير موجودة", 404);
    const [item] = await db.update(paymentMethods).set({ ...payload, updatedAt: new Date() }).where(eq(paymentMethods.id, params.id)).returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "payment_method", entityId: item.id, beforeData: toPaymentMethodClientDto(before), afterData: toPaymentMethodClientDto(item) });
    return ok({ paymentMethod: toPaymentMethodClientDto(item), message: "تم تعديل وسيلة الدفع بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر تعديل وسيلة الدفع");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const session = await requireAuth();
    await assertAdmin(session, "payments.manage");
    const [before] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, params.id)).limit(1);
    if (!before) return fail("وسيلة الدفع غير موجودة", 404);
    await db.update(paymentMethods).set({ isActive: false, updatedAt: new Date() }).where(eq(paymentMethods.id, params.id));
    await writeAuditLog({ actorId: session.userId, action: "delete", entityType: "payment_method", entityId: params.id, beforeData: toPaymentMethodClientDto(before), afterData: { isActive: false } });
    return ok({ message: "تم تعطيل وسيلة الدفع بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حذف وسيلة الدفع لوجود طلبات مرتبطة");
  }
}
