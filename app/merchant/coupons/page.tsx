export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CouponManagementPanel } from "@/components/merchant/coupon-form";
import { requireAuth } from "@/lib/auth";
import { coupons, db } from "@/lib/db";
import { getMerchantPrimaryStore } from "@/lib/db/queries";

export default async function MerchantCouponsPage() {
  const session = await requireAuth();
  const store = await getMerchantPrimaryStore(session.userId);
  const items = store ? await db.select().from(coupons).where(eq(coupons.storeId, store.id)).orderBy(desc(coupons.createdAt)) : [];
  return <main className="min-h-screen merchant-aurora"><SiteHeader/><section className="container py-8"><div className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-black">الكوبونات والخصومات</h1><p className="mt-2 text-sm text-slate-500">أنشئ كوبونات للمتجر ليستخدمها العملاء في checkout.</p></div><Button asChild variant="outline"><Link href="/merchant">العودة</Link></Button></div>{!store?<EmptyState title="لا يوجد متجر"/>:<CouponManagementPanel coupons={items}/>}</section></main>;
}
