export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { fail, handleApiError, ok } from "@/lib/api";
import { hashPassword, requireAuth, revokeUserSessions } from "@/lib/auth";
import { db, notifications, stores, users } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { sendOptionalActivationMessages } from "@/lib/outbound";
import { writeAuditLog } from "@/lib/audit";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await requireAuth();
    await assertAdmin(session, "stores.manage");

    const [store] = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
    if (!store) return fail("المتجر غير موجود", 404);
    const [merchant] = await db.select().from(users).where(eq(users.id, store.merchantId)).limit(1);
    if (!merchant) return fail("مالك المتجر غير موجود", 404);

    const temporaryPassword = `Tmp-${nanoid(14)}!`;
    const passwordHash = await hashPassword(temporaryPassword);
    const revokedSessions = await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, mustChangePassword: true, status: "active", updatedAt: new Date() }).where(eq(users.id, merchant.id));
      return revokeUserSessions(merchant.id, { tx });
    });

    await db.insert(notifications).values({
      userId: merchant.id,
      storeId: store.id,
      title: "تم إصدار بيانات دخول جديدة للمتجر",
      body: `رقم المتجر: ${store.storeNumber}\nاسم المستخدم: ${merchant.email}\nكلمة المرور المؤقتة: ${temporaryPassword}`,
      type: "merchant_credentials_reissued",
      data: { storeId: store.id, storeNumber: store.storeNumber, username: merchant.email, temporaryPassword }
    });

    await sendOptionalActivationMessages({
      email: merchant.email,
      phone: merchant.phone,
      subject: "بيانات دخول جديدة للمتجر",
      message: `رقم المتجر: ${store.storeNumber}\nاسم المستخدم: ${merchant.email}\nكلمة المرور المؤقتة: ${temporaryPassword}`
    });

    await writeAuditLog({ actorId: session.userId, action: "update", entityType: "security.merchant_credentials_reset", entityId: store.id, afterData: { merchantId: merchant.id, storeNumber: store.storeNumber, revokedSessions } });
    return ok({ storeNumber: store.storeNumber, username: merchant.email, temporaryPassword, message: "تم إصدار كلمة مرور مؤقتة وإرسال إشعار للتاجر" });
  } catch (error) {
    return handleApiError(error, "تعذر إصدار بيانات الدخول");
  }
}
