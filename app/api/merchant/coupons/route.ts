export const dynamic = "force-dynamic";

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { created, fail, handleApiError, ok } from "@/lib/api";
import { hasStoreAccess, requireAuth } from "@/lib/auth";
import { coupons, db } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";
import { normalizeCouponCode } from "@/lib/coupons";
import { Permission, userHasAnyStorePermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({ code: z.string().min(2), title: z.string().min(2), description: z.string().optional(), discountType: z.enum(["percent", "fixed"]).default("percent"), discountValue: z.coerce.number().min(0), maxDiscount: z.coerce.number().min(0).optional().nullable(), minOrderAmount: z.coerce.number().min(0).default(0), usageLimit: z.coerce.number().int().positive().optional().nullable(), perCustomerLimit: z.coerce.number().int().positive().default(1), startsAt: z.string().datetime().optional().nullable(), endsAt: z.string().datetime().optional().nullable(), status: z.enum(["active", "disabled", "draft"]).default("active") });

export async function GET() {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return ok({ coupons: [] });
    const items = await db.select().from(coupons).where(eq(coupons.storeId, store.id)).orderBy(desc(coupons.createdAt));
    return ok({ coupons: items });
  } catch (error) {
    return handleApiError(error, "تعذر تحميل الكوبونات");
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const store = await getMerchantPrimaryStore(session.userId);
    if (!store) return fail("لا يوجد متجر", 403);
    if (!hasStoreAccess(session, store.id)) return fail("لا تملك صلاحية المتجر", 403);
    if (!(await userHasAnyStorePermission(session.userId, store.id, [Permission.ManageStoreCoupons, Permission.ManageAnnouncements]))) return fail("لا تملك صلاحية التسويق والكوبونات", 403);
    const payload = schema.parse(await request.json());
    const [coupon] = await db.insert(coupons).values({ storeId: store.id, code: normalizeCouponCode(payload.code), title: payload.title, description: payload.description, discountType: payload.discountType, discountValue: payload.discountValue.toString(), maxDiscount: payload.maxDiscount?.toString(), minOrderAmount: payload.minOrderAmount.toString(), usageLimit: payload.usageLimit, perCustomerLimit: payload.perCustomerLimit, startsAt: payload.startsAt ? new Date(payload.startsAt) : null, endsAt: payload.endsAt ? new Date(payload.endsAt) : null, status: payload.status, createdBy: session.userId }).returning();
    await writeAuditLog({ actorId: session.userId, action: "create", entityType: "coupon", entityId: coupon.id, afterData: coupon });
    return created({ coupon, message: "تم إنشاء الكوبون" });
  } catch (error) {
    return handleApiError(error, "تعذر إنشاء الكوبون");
  }
}
