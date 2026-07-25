export const dynamic = "force-dynamic";

import { asc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { db, shippingMethods } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { userHasStoreOperation } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { writeAuditLog } from "@/lib/audit";
import { shippingCoverageSchema } from "@/lib/shipping/coverage";

const schema = z.object({
  storeId: z.string().uuid().optional(),
  name: z.string().min(2),
  code: z.string().optional(),
  description: z.string().optional(),
  fee: z.coerce.number().min(0).default(0),
  estimatedDaysMin: z.coerce.number().int().min(0).default(1),
  estimatedDaysMax: z.coerce.number().int().min(0).default(3),
  coverageConfig: shippingCoverageSchema.default({ mode: "all_yemen", governorateIds: [], feeOverrides: [], codEnabled: true }),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0)
});

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ shippingMethods: [] });
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية الوصول للمتجر", 403);
    if (!(await userHasStoreOperation(session.userId, store.id, "shipping.view"))) return fail("لا تملك صلاحية عرض وسائل الشحن", 403);
    const items = await db.select().from(shippingMethods).where(or(eq(shippingMethods.storeId, store.id), isNull(shippingMethods.storeId))).orderBy(asc(shippingMethods.sortOrder), asc(shippingMethods.name));
    return ok({ shippingMethods: items });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل وسائل شحن المتجر");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const payload = schema.parse(await request.json());
    const primary = await getMerchantPrimaryStore(session.userId);
    const storeId = payload.storeId || primary?.id;
    if (!storeId) return fail("لا يوجد متجر مرتبط بحسابك", 403);
    if (!hasStoreAccess(session, storeId)) return fail("لا تملك صلاحية إدارة هذا المتجر", 403);
    if (!(await userHasStoreOperation(session.userId, storeId, "shipping.manage"))) return fail("لا تملك صلاحية إعدادات المتجر", 403);
    const code = `${storeId.slice(0, 8)}_${payload.code || slugify(payload.name) || "shipping"}`.slice(0, 120);
    const [method] = await db.insert(shippingMethods).values({ ...payload, storeId, code, fee: payload.fee.toString() }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "store_shipping_method", entityId: method.id, afterData: method });
    return created({ shippingMethod: method, message: "تم حفظ وسيلة شحن المتجر" });
  } catch (error) {
    return handleApiError(error, "تعذر حفظ وسيلة شحن المتجر");
  }
}
