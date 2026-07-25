export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { adInvoices, db } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ invoices: [] });
    if (!hasStoreAccess(session, store.id)) return ok({ invoices: [] });
    const allowed = await userHasAnyStorePermission(session.userId, store.id, ["store.ads.billing.view", "store.ads.view", Permission.ManageStoreAds]);
    if (!allowed) return ok({ invoices: [] });
    const invoices = await db.select().from(adInvoices).where(eq(adInvoices.storeId, store.id)).orderBy(desc(adInvoices.createdAt)).limit(100);
    return ok({ invoices });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل فواتير الإعلانات");
  }
}
