import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { OrderTrackingPanel } from "@/components/customer/order-tracking-panel";

export default function TrackOrderPage() {
  return <main className="min-h-screen bg-slate-50"><SiteHeader/><section className="container py-8"><div className="mb-8 flex items-center justify-between"><div><h1 className="text-3xl font-black">تتبع الطلب</h1><p className="mt-2 text-sm text-slate-500">أدخل رقم الطلب والبريد أو الهاتف المرتبط به.</p></div><Button asChild variant="outline"><Link href="/">الرئيسية</Link></Button></div><OrderTrackingPanel/></section><Footer/></main>;
}
