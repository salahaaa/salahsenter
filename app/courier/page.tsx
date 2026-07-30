"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Truck, Phone, MessageCircle, MapPin, Store, AlertCircle, ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CourierOrderData = {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    grandTotal: number;
    createdAt: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    storeName: string;
    storePhone: string;
    storeId: string;
  };
  shipment: {
    trackingNumber?: string | null;
    carrierName?: string | null;
    status?: string | null;
  };
};

export default function CourierPortalPage() {
  const [data, setData] = useState<CourierOrderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [courierPhone, setCourierPhone] = useState("");

  async function lookupOrder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setSuccessMsg(null);
    const form = new FormData(e.currentTarget);
    const orderNumber = String(form.get("orderNumber") || "").trim();
    const identifier = String(form.get("identifier") || "").trim();

    try {
      const res = await fetch(`/api/courier/orders?orderNumber=${encodeURIComponent(orderNumber)}&identifier=${encodeURIComponent(identifier)}`);
      const json = await res.json();
      if (!res.ok) {
        setData(null);
        setMessage(json.message || "تعذر العثور على الطلب");
      } else {
        setData(json.data);
        setMessage(null);
      }
    } catch {
      setMessage("حدث خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(action: string) {
    if (!data) return;
    setLoading(true);
    setSuccessMsg(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/courier/orders/${data.order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note, courierPhone })
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.message || "تعذر تحديث الحالة");
      } else {
        setSuccessMsg(json.data?.message || "تم تحديث الحالة بنجاح");
        setNote("");
        // refresh data
        setData((prev) => prev ? {
          ...prev,
          order: { ...prev.order, status: json.data?.status || prev.order.status }
        } : null);
      }
    } catch {
      setMessage("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }

  function getWhatsAppUrl(phone: string, text: string) {
    const clean = phone.replace(/[^0-9]/g, "");
    return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <SiteHeader />
      <section className="container max-w-4xl py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">
              <Truck className="h-4 w-4" /> واجهة مندوب التوصيل
            </div>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">بوابة توصيل الشحنات الحية</h1>
            <p className="mt-2 text-sm text-slate-500">استعلم عن طلبك، حدّث حالة التوصيل، وتواصل فوراً مع العميل عبر الوتساب.</p>
          </div>
          <Button asChild variant="outline"><Link href="/">الرئيسية</Link></Button>
        </div>

        <form onSubmit={lookupOrder} className="grid gap-4 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-[1fr_1fr_auto]">
          <Input name="orderNumber" placeholder="رقم الطلب ORD-..." required className="h-12 rounded-xl text-base font-bold" />
          <Input name="identifier" placeholder="هاتف أو إيميل العميل" required className="h-12 rounded-xl text-base font-bold" />
          <Button type="submit" disabled={loading} className="h-12 rounded-xl px-8 font-black">
            {loading ? "يبحث..." : "استعلام الطلب"}
          </Button>
        </form>

        {message ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" /> {message}
          </div>
        ) : null}

        {successMsg ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" /> {successMsg}
          </div>
        ) : null}

        {data ? (
          <div className="mt-6 space-y-6 rounded-3xl border bg-white p-6 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
              <div>
                <h2 className="text-2xl font-black">{data.order.orderNumber}</h2>
                <p className="mt-1 text-sm text-slate-500">تاريخ الطلب: {new Date(data.order.createdAt).toLocaleString("ar")}</p>
              </div>
              <div className="rounded-2xl bg-indigo-50 px-4 py-2 font-black text-indigo-900">
                الحالة: {data.order.status === "shipped" ? "قيد الشحن / في الطريق" : data.order.status === "delivered" ? "تم التسليم بنجاح" : data.order.status === "preparing" ? "قيد التجهيز" : data.order.status}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <h3 className="flex items-center gap-2 font-black text-slate-900">
                  <MapPin className="h-5 w-5 text-blue-600" /> بيانات العميل المستلم
                </h3>
                <p className="mt-3 font-bold">{data.order.customerName || "عميل المول"}</p>
                <p className="mt-1 text-sm text-slate-600">الهاتف: {data.order.customerPhone || "غير محدد"}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.order.customerPhone ? (
                    <>
                      <Button asChild size="sm" variant="outline" className="gap-2">
                        <a href={`tel:${data.order.customerPhone}`}>
                          <Phone className="h-4 w-4" /> اتصال مباشر
                        </a>
                      </Button>
                      <Button asChild size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                        <a
                          href={getWhatsAppUrl(
                            data.order.customerPhone,
                            `مرحباً ${data.order.customerName}، أنا مندوب توصيل طلبك رقم #${data.order.orderNumber} من متجر ${data.order.storeName}. أنا في الطريق إلى موقعك الآن.`
                          )}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageCircle className="h-4 w-4" /> تنبيه وتساب للعميل
                        </a>
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border bg-slate-50 p-4">
                <h3 className="flex items-center gap-2 font-black text-slate-900">
                  <Store className="h-5 w-5 text-orange-600" /> بيانات المتجر المرسل
                </h3>
                <p className="mt-3 font-bold">{data.order.storeName}</p>
                <p className="mt-1 text-sm text-slate-600">هاتف المتجر: {data.order.storePhone || "غير مسجل"}</p>
                {data.order.storePhone ? (
                  <Button asChild size="sm" variant="outline" className="mt-4 gap-2">
                    <a href={`tel:${data.order.storePhone}`}>
                      <Phone className="h-4 w-4" /> اتصال بالمتجر
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border bg-slate-50/60 p-5">
              <h3 className="font-black text-slate-900">تحديث حالة التوصيل (أزرار المندوب السريعة)</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="رقم هاتف المندوب للتواصل (اختياري)"
                  value={courierPhone}
                  onChange={(e) => setCourierPhone(e.target.value)}
                  className="rounded-xl bg-white"
                />
                <Input
                  placeholder="ملاحظة أو إشعار (مثلاً: وصلت للموقع وينتظر العميل)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="rounded-xl bg-white"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Button
                  type="button"
                  onClick={() => updateStatus("out_for_delivery")}
                  disabled={loading}
                  className="h-14 rounded-2xl bg-blue-600 text-base font-black hover:bg-blue-700"
                >
                  🚚 في الطريق للعميل (Out for Delivery)
                </Button>

                <Button
                  type="button"
                  onClick={() => updateStatus("note")}
                  disabled={loading}
                  variant="outline"
                  className="h-14 rounded-2xl border-2 text-base font-black"
                >
                  📍 تسجيل ملاحظة وصول
                </Button>

                <Button
                  type="button"
                  onClick={() => updateStatus("delivered")}
                  disabled={loading}
                  className="h-14 rounded-2xl bg-emerald-600 text-base font-black hover:bg-emerald-700"
                >
                  ✅ تم التسليم بنجاح (Mark Delivered)
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
      <Footer />
    </main>
  );
}
