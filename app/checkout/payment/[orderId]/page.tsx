export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { PaymentStartPanel } from "@/components/payments/payment-start-panel";
import { requireAuth } from "@/lib/auth";
import { db, orderPayments, orders, paymentMethods } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

export default async function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const session = await requireAuth();
  const [row] = await db.select({ order: orders, payment: orderPayments, method: paymentMethods }).from(orders).leftJoin(orderPayments, eq(orderPayments.orderId, orders.id)).leftJoin(paymentMethods, eq(orderPayments.paymentMethodId, paymentMethods.id)).where(and(eq(orders.id, orderId), eq(orders.customerId, session.userId))).limit(1);
  if (!row) notFound();
  return <main className="min-h-screen bg-slate-50"><SiteHeader/><section className="container py-8"><div className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-black">دفع الطلب</h1><p className="mt-2 text-sm text-slate-500">{row.order.orderNumber} — {formatCurrency(row.order.grandTotal, row.order.currency)}</p></div><Button asChild variant="outline"><Link href={`/orders/${row.order.id}`}>تفاصيل الطلب</Link></Button></div><PaymentStartPanel orderId={row.order.id} provider={row.method?.provider || "manual"} paymentStatus={row.order.paymentStatus} amount={row.order.grandTotal} currency={row.order.currency}/></section><Footer/></main>;
}
