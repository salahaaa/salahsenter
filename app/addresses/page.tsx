export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { AddressBookPanel } from "@/components/customer/address-book-panel";
import { requireAuth } from "@/lib/auth";
import { customerAddresses, db, governorates } from "@/lib/db";

export default async function AddressesPage() {
  const session = await requireAuth();
  const [addresses, governorateRows] = await Promise.all([
    db.select().from(customerAddresses).where(eq(customerAddresses.userId, session.userId)).orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.updatedAt)),
    db.select({ id: governorates.id, name: governorates.name }).from(governorates).where(eq(governorates.isActive, true)).orderBy(governorates.sortOrder, governorates.name)
  ]);
  return <main className="min-h-screen bg-slate-50"><SiteHeader/><section className="container py-8"><div className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-black">دفتر العناوين</h1><p className="mt-2 text-sm text-slate-500">احفظ عناوين التوصيل لاستخدامها في الطلبات.</p></div><Button asChild variant="outline"><Link href="/checkout">العودة للدفع</Link></Button></div><AddressBookPanel addresses={addresses} governorates={governorateRows}/></section><Footer/></main>;
}
