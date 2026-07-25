export const dynamic = "force-dynamic";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { db, notifications, stores } from "@/lib/db";
import { assertAdmin } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  target: z.enum(["all_stores", "wing", "stores"]),
  wingId: z.string().uuid().optional().nullable(),
  storeIds: z.array(z.string().uuid()).optional().default([]),
  title: z.string().min(2).max(180),
  body: z.string().min(2).max(2000),
  type: z.string().min(2).max(80).default("admin_broadcast")
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await assertAdmin(session, "notifications.manage");
    const payload = schema.parse(await request.json());

    let storeRows: Array<{ id: string; merchantId: string; name: string }> = [];
    if (payload.target === "all_stores") {
      storeRows = await db.select({ id: stores.id, merchantId: stores.merchantId, name: stores.name }).from(stores).where(and(eq(stores.status, "active"), eq(stores.isActive, true)));
    } else if (payload.target === "wing") {
      if (!payload.wingId) return fail("اختر الجناح أولاً", 422);
      storeRows = await db.select({ id: stores.id, merchantId: stores.merchantId, name: stores.name }).from(stores).where(and(eq(stores.primaryWingId, payload.wingId), eq(stores.status, "active"), eq(stores.isActive, true)));
    } else {
      if (!payload.storeIds.length) return fail("اختر متجراً واحداً على الأقل", 422);
      storeRows = await db.select({ id: stores.id, merchantId: stores.merchantId, name: stores.name }).from(stores).where(inArray(stores.id, payload.storeIds));
    }

    if (!storeRows.length) return fail("لا توجد متاجر مطابقة للإرسال", 404);

    const values = storeRows.map((store) => ({
      userId: store.merchantId,
      storeId: store.id,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      data: { target: payload.target, wingId: payload.wingId || null, storeId: store.id, storeName: store.name, sentBy: session.userId, url: "/merchant" }
    }));
    await db.insert(notifications).values(values);
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "admin_notification_broadcast", entityId: payload.target, afterData: { ...payload, count: values.length } });
    return ok({ sent: values.length, message: `تم إرسال الإشعار إلى ${values.length} متجر` });
  } catch (error) {
    return handleApiError(error, "تعذر إرسال الإشعار للمتاجر");
  }
}
