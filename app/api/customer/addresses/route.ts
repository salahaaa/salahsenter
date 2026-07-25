export const dynamic = "force-dynamic";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { customerAddresses, db } from "@/lib/db";

const addressSchema = z.object({
  label: z.string().optional().default("العنوان الرئيسي"),
  recipientName: z.string().min(2),
  phone: z.string().min(5),
  countryId: z.string().uuid().optional().nullable(),
  governorateId: z.string().uuid().optional().nullable(),
  cityId: z.string().uuid().optional().nullable(),
  districtId: z.string().uuid().optional().nullable(),
  cityText: z.string().optional().nullable(),
  districtText: z.string().optional().nullable(),
  addressLine: z.string().min(4),
  landmark: z.string().optional().nullable(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  isDefault: z.boolean().optional().default(false)
});

export async function GET() {
  try {
    const session = await requireAuth();
    const addresses = await db.select().from(customerAddresses).where(eq(customerAddresses.userId, session.userId)).orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.updatedAt));
    return ok({ addresses });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل العناوين");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = addressSchema.parse(await request.json());
    const result = await db.transaction(async (tx) => {
      if (payload.isDefault) await tx.update(customerAddresses).set({ isDefault: false, updatedAt: new Date() }).where(and(eq(customerAddresses.userId, session.userId), eq(customerAddresses.isDefault, true)));
      const [address] = await tx.insert(customerAddresses).values({ ...payload, userId: session.userId, latitude: payload.latitude?.toString(), longitude: payload.longitude?.toString() }).returning();
      return address;
    });
    return created({ address: result, message: "تم حفظ العنوان" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ العنوان");
  }
}
