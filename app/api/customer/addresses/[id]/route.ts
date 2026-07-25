export const dynamic = "force-dynamic";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { customerAddresses, db } from "@/lib/db";

const patchSchema = z.object({
  label: z.string().optional(), recipientName: z.string().min(2).optional(), phone: z.string().min(5).optional(), countryId: z.string().uuid().optional().nullable(), governorateId: z.string().uuid().optional().nullable(), cityId: z.string().uuid().optional().nullable(), districtId: z.string().uuid().optional().nullable(), cityText: z.string().optional().nullable(), districtText: z.string().optional().nullable(), addressLine: z.string().min(4).optional(), landmark: z.string().optional().nullable(), latitude: z.coerce.number().optional().nullable(), longitude: z.coerce.number().optional().nullable(), isDefault: z.boolean().optional()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const payload = patchSchema.parse(await request.json());
    const [before] = await db.select().from(customerAddresses).where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, session.userId))).limit(1);
    if (!before) return fail("العنوان غير موجود", 404);
    const result = await db.transaction(async (tx) => {
      if (payload.isDefault) await tx.update(customerAddresses).set({ isDefault: false, updatedAt: new Date() }).where(and(eq(customerAddresses.userId, session.userId), eq(customerAddresses.isDefault, true)));
      const [address] = await tx.update(customerAddresses).set({ ...payload, latitude: payload.latitude?.toString(), longitude: payload.longitude?.toString(), updatedAt: new Date() }).where(eq(customerAddresses.id, id)).returning();
      return address;
    });
    return ok({ address: result, message: "تم تحديث العنوان" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث العنوان");
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    const [address] = await db.delete(customerAddresses).where(and(eq(customerAddresses.id, id), eq(customerAddresses.userId, session.userId))).returning();
    if (!address) return fail("العنوان غير موجود", 404);
    return ok({ message: "تم حذف العنوان" });
  } catch (error) {
    return handleApiError(error, "تعذر حذف العنوان");
  }
}
