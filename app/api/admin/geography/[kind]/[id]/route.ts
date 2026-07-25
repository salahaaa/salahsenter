export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { cities, countries, db, districts, governorates } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional()
});

type Params = { params: Promise<{ kind: string; id: string }> };

export async function PATCH(request: Request, context: Params) {
  const params = await context.params;
  try {
    const session = await requireAuth();
    await assertAdmin(session, "geography.manage");
    const payload = updateSchema.parse(await request.json());

    if (params.kind === "countries") {
      const [item] = await db.update(countries).set(payload).where(eq(countries.id, params.id)).returning();
      await writeAuditLog({ actorId: session.userId, action: "update", entityType: "country", entityId: params.id, afterData: item });
      return ok({ item, message: "تم التحديث بنجاح" });
    }
    if (params.kind === "governorates") {
      const [item] = await db.update(governorates).set(payload).where(eq(governorates.id, params.id)).returning();
      await writeAuditLog({ actorId: session.userId, action: "update", entityType: "governorate", entityId: params.id, afterData: item });
      return ok({ item, message: "تم التحديث بنجاح" });
    }
    if (params.kind === "cities") {
      const [item] = await db.update(cities).set(payload).where(eq(cities.id, params.id)).returning();
      await writeAuditLog({ actorId: session.userId, action: "update", entityType: "city", entityId: params.id, afterData: item });
      return ok({ item, message: "تم التحديث بنجاح" });
    }
    if (params.kind === "districts") {
      const [item] = await db.update(districts).set(payload).where(eq(districts.id, params.id)).returning();
      await writeAuditLog({ actorId: session.userId, action: "update", entityType: "district", entityId: params.id, afterData: item });
      return ok({ item, message: "تم التحديث بنجاح" });
    }

    return fail("نوع غير مدعوم", 400);
  } catch (error) {
    return handleApiError(error, "تعذر تحديث العنصر");
  }
}

export async function DELETE(_request: Request, context: Params) {
  const params = await context.params;
  try {
    const session = await requireAuth();
    await assertAdmin(session, "geography.manage");

    let item;
    if (params.kind === "countries") [item] = await db.update(countries).set({ isActive: false }).where(eq(countries.id, params.id)).returning();
    else if (params.kind === "governorates") [item] = await db.update(governorates).set({ isActive: false }).where(eq(governorates.id, params.id)).returning();
    else if (params.kind === "cities") [item] = await db.update(cities).set({ isActive: false }).where(eq(cities.id, params.id)).returning();
    else if (params.kind === "districts") [item] = await db.update(districts).set({ isActive: false }).where(eq(districts.id, params.id)).returning();
    else return fail("نوع غير مدعوم", 400);

    if (!item) return fail("العنصر غير موجود", 404);
    await writeAuditLog({ actorId: session.userId, action: "delete", entityType: params.kind, entityId: params.id, afterData: item });
    return ok({ message: "تم تعطيل العنصر بنجاح" });
  } catch (error) {
    return handleApiError(error, "تعذر حذف العنصر لوجود بيانات مرتبطة به");
  }
}
