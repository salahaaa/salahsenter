export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { OrderStatusActions } from "@/components/merchant/order-status-actions";
import { ShipmentUpdateForm } from "@/components/merchant/shipment-update-form";
import { AiOrderReplyDraft } from "@/components/merchant/ai-order-reply-draft";
import { OrderDetailView } from "@/components/orders/order-detail-view";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { getOrderDetails } from "@/lib/order-details";

export default async function MerchantOrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth();
  const data = await getOrderDetails(id, session);
  if (!data) notFound();
  return <main className="min-h-screen merchant-aurora"><SiteHeader /><section className="container py-8"><div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black text-slate-950">تفاصيل طلب التاجر</h1><p className="mt-2 text-sm text-slate-500">راجع الفاتورة ثم غيّر الحالة حسب تجهيز الطلب.</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href="/merchant/orders">العودة للطلبات</Link></Button><Button asChild variant="outline"><Link href={`/orders/${data.order.id}/invoice`}>الفاتورة</Link></Button></div></div><div className="mb-6 rounded-3xl border bg-white p-5 shadow-card"><h2 className="mb-3 font-black">تحديث حالة الطلب</h2><OrderStatusActions orderId={data.order.id} statusCode={data.order.statusCode} paymentStatus={data.order.paymentStatus} /></div><div className="mb-6"><ShipmentUpdateForm orderId={data.order.id} shipment={data.shipments[0] || null} /></div><div className="mb-6"><AiOrderReplyDraft orderId={data.order.id}/></div><OrderDetailView data={data} viewer="merchant" /></section></main>;
}
