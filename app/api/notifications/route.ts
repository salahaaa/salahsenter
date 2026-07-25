export const dynamic = "force-dynamic";

import { and, desc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { handleApiError, ok } from "@/lib/api";
import { hasRole, requireAuth } from "@/lib/auth";
import { db, notifications } from "@/lib/db";

const schema = z.object({ action: z.enum(["mark_all_read"]), ids: z.array(z.string()).optional() });

export async function GET() {
  try {
    const session = await requireAuth();
    const isAdmin = hasRole(session, "super_admin");
    const where = isAdmin
      ? or(eq(notifications.userId, session.userId), and(isNull(notifications.userId), isNull(notifications.storeId)))
      : eq(notifications.userId, session.userId);
    const items = await db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt)).limit(50);
    return ok({ notifications: items });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل التنبيهات");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    if (payload.action === "mark_all_read") {
      await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.userId, session.userId));
    }
    return ok({ message: "تم تحديث التنبيهات" });
  } catch (error) {
    return handleApiError(error, "تعذر تحديث التنبيهات");
  }
}
