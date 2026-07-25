export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { OrderDetailView } from "@/components/orders/order-detail-view";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { getOrderDetails } from "@/lib/order-details";

export default async function CustomerOrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth();
  const data = await getOrderDetails(id, session);
  if (!data || data.order.customerId !== session.userId) notFound();
  return <main className="min-h-screen bg-slate-50"><SiteHeader /><section className="container py-8"><div className="mb-6 flex items-center justify-between"><h1 className="text-3xl font-black text-slate-950">تفاصيل الطلب</h1><Button asChild variant="outline"><Link href="/orders">طلباتي</Link></Button></div><OrderDetailView data={data} viewer="customer" /></section><Footer /></main>;
}
