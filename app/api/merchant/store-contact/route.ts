export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, stores } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  contactPhone: z.string().max(40).optional().nullable(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  whatsapp: z.string().max(120).optional().nullable(),
  facebook: z.string().max(255).optional().nullable(),
  instagram: z.string().max(255).optional().nullable(),
  videoUrl: z.string().max(500).optional().nullable()
});

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية تعديل بيانات هذا المتجر", 403);
    const payload = schema.parse(await request.json());
    if (payload.contactEmail !== undefined && String(payload.contactEmail || "").trim().toLowerCase() !== String(store.contactEmail || "").trim().toLowerCase()) {
      return fail("البريد الإلكتروني المعتمد للمتجر محمي تعاقدياً. أرسل طلب تعديل هوية المتجر ليُنشأ ملحق عقد ويعتمد من الإدارة.", 409);
    }
    const socialLinks = {
      ...(store.socialLinks || {}),
      whatsapp: payload.whatsapp || "",
      facebook: payload.facebook || "",
      instagram: payload.instagram || ""
    };
    const [updated] = await db.update(stores).set({
      contactPhone: payload.contactPhone || null,
      contactEmail: store.contactEmail,
      videoUrl: payload.videoUrl || store.videoUrl,
      socialLinks,
      updatedAt: new Date()
    }).where(eq(stores.id, store.id)).returning();
    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "store_contact", entityId: store.id, beforeData: store, afterData: updated });
    return ok({ store: updated, message: "تم تحديث بيانات التواصل" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث بيانات التواصل");
  }
}
