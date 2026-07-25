export const dynamic = "force-dynamic";

import { asc } from "drizzle-orm";
import { z } from "zod";
import { created, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, paymentMethods } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { paymentInstructionConfigSchema, toPaymentMethodClientDto } from "@/lib/payments/config";

const providerSchema = z.enum(["manual", "cod", "bank_transfer", "wallet", "remittance", "local_gateway", "stripe"]);
const schema = z.object({
  name: z.string().trim().min(2).max(140),
  code: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2_000).optional(),
  provider: providerSchema.default("manual"),
  config: paymentInstructionConfigSchema.default({}),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0)
});

export async function GET() {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "payments.manage");
    const items = await db.select().from(paymentMethods).orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.name));
    return ok({ paymentMethods: items.map(toPaymentMethodClientDto) });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل وسائل الدفع");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "payments.manage");
    const payload = schema.parse(await request.json());
    const [item] = await db.insert(paymentMethods).values(payload).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "payment_method", entityId: item.id, afterData: toPaymentMethodClientDto(item) });
    return created({ paymentMethod: toPaymentMethodClientDto(item), message: "تم حفظ وسيلة الدفع بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ وسيلة الدفع");
  }
}
