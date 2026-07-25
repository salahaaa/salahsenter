import { and, eq, isNull, or, sql } from "drizzle-orm";
import { couponRedemptions, coupons, db } from "@/lib/db";

type DbLike = any;

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "").slice(0, 80);
}

export async function validateCoupon(input: { code: string; storeId: string; userId: string; subtotal: number }, tx: DbLike = db) {
  const code = normalizeCouponCode(input.code);
  if (!code) return { valid: false as const, message: "كود الخصم فارغ", discountAmount: 0 };
  const now = new Date();
  const [coupon] = await tx
    .select()
    .from(coupons)
    .where(and(eq(coupons.code, code), eq(coupons.status, "active"), or(eq(coupons.storeId, input.storeId), isNull(coupons.storeId)), or(isNull(coupons.startsAt), sql`${coupons.startsAt} <= ${now}`), or(isNull(coupons.endsAt), sql`${coupons.endsAt} >= ${now}`)))
    .orderBy(sql`case when ${coupons.storeId} = ${input.storeId} then 0 else 1 end`)
    .limit(1);
  if (!coupon) return { valid: false as const, message: "كود الخصم غير صالح أو منتهي", discountAmount: 0 };
  if (input.subtotal < Number(coupon.minOrderAmount || 0)) return { valid: false as const, message: `الحد الأدنى لاستخدام الكوبون هو ${coupon.minOrderAmount}`, discountAmount: 0 };
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return { valid: false as const, message: "تم استهلاك حد استخدام الكوبون", discountAmount: 0 };
  const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(couponRedemptions).where(and(eq(couponRedemptions.userId, input.userId), eq(couponRedemptions.code, code)));
  if (Number(count || 0) >= Number(coupon.perCustomerLimit || 1)) return { valid: false as const, message: "لقد استخدمت هذا الكوبون مسبقاً", discountAmount: 0 };
  let discountAmount = coupon.discountType === "fixed" ? Number(coupon.discountValue || 0) : input.subtotal * (Number(coupon.discountValue || 0) / 100);
  if (coupon.maxDiscount != null) discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
  discountAmount = Math.max(0, Math.min(input.subtotal, Number(discountAmount.toFixed(2))));
  return { valid: true as const, coupon, code, discountAmount, message: "كود الخصم صالح" };
}
