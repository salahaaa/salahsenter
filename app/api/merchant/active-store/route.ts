export const dynamic = "force-dynamic";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, stores } from "@/lib/db";

const schema = z.object({ storeId: z.string().uuid() });

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const [store] = await db.select().from(stores).where(eq(stores.id, payload.storeId)).limit(1);
    if (!store) return fail("المحل غير موجود", 404);
    if (store.merchantId !== session.userId && !hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية إدارة هذا المحل", 403);
    const response = ok({ store, message: `تم اختيار ${store.name} كمحل نشط للإدارة` });
    response.cookies.set("merchant_store_id", store.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
    return response;
  } catch (error) {
    return handleApiError(error, "تعذر اختيار المحل النشط");
  }
}
