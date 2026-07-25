"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Boxes, ReceiptText, Truck, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Variant = { variantId: string; sku: string; title: string | null; productName: string; stockQuantity: number; price: string };
type Supplier = { id: string; name: string; code: string | null; phone: string | null; status: string };

export function AdvancedInventoryPanel({ storeId, variants }: { storeId: string; variants: Variant[] }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const variantsById = useMemo(() => new Map(variants.map((variant) => [variant.variantId, variant])), [variants]);

  const refresh = useCallback(async () => {
    const [supplierResponse, batchResponse] = await Promise.all([
      fetch(`/api/merchant/suppliers?storeId=${storeId}`, { cache: "no-store" }),
      fetch("/api/merchant/inventory/batches", { cache: "no-store" })
    ]);
    const suppliersJson = await supplierResponse.json().catch(() => ({}));
    const batchesJson = await batchResponse.json().catch(() => ({}));
    if (supplierResponse.ok) setSuppliers(suppliersJson.data?.suppliers || []);
    if (batchResponse.ok) setBatches(batchesJson.data?.batches || []);
    else if (batchResponse.status === 403) setMessage(batchesJson.message || "الدُفعات والصلاحية غير مفعلة لهذا القطاع بعد.");
  }, [storeId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function request(url: string, body: Record<string, unknown>) {
    setLoading(true);
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || "تعذر حفظ العملية");
      setMessage(json.data?.message || "تم الحفظ");
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر حفظ العملية"); }
    finally { setLoading(false); }
  }

  async function addSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await request("/api/merchant/suppliers", { storeId, name: form.get("name"), code: form.get("code") || undefined, phone: form.get("phone") || undefined, contactName: form.get("contactName") || undefined });
    event.currentTarget.reset();
  }

  async function receiveCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await request("/api/merchant/inventory/cost-receipts", { storeId, variantId: form.get("variantId"), supplierId: form.get("supplierId") || null, quantity: Number(form.get("quantity") || 0), unitCost: Number(form.get("unitCost") || 0), referenceNumber: form.get("referenceNumber") || undefined, batchNumber: form.get("batchNumber") || null, expiryDate: form.get("expiryDate") ? new Date(`${form.get("expiryDate")}T00:00:00.000Z`).toISOString() : null });
  }

  return <section className="mt-8 grid gap-6 xl:grid-cols-2">
    <div className="rounded-3xl border bg-white p-6 shadow-card"><div className="mb-4 flex items-center gap-2"><UsersRound className="h-5 w-5 text-teal-600" /><div><h2 className="font-black">الموردون وتكلفة الشراء</h2><p className="mt-1 text-xs leading-5 text-slate-500">المورد اختياري عند استلام المخزون، لكن التكلفة تحدث متوسط تكلفة المتغير بشكل مرجّح.</p></div></div><form onSubmit={addSupplier} className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-2"><Field name="name" label="اسم المورد" required /><Field name="code" label="كود المورد" /><Field name="contactName" label="اسم المسؤول" /><Field name="phone" label="الهاتف" /><div className="md:col-span-2"><Button disabled={loading}>إضافة المورد</Button></div></form><div className="mt-4 max-h-44 space-y-2 overflow-auto">{suppliers.length ? suppliers.map((supplier) => <div key={supplier.id} className="flex items-center justify-between rounded-xl border p-3 text-sm"><div><b>{supplier.name}</b><span className="mr-2 text-xs text-slate-400">{supplier.code || "—"} {supplier.phone ? `• ${supplier.phone}` : ""}</span></div><Badge variant={supplier.status === "active" ? "success" : "warning"}>{supplier.status}</Badge></div>) : <p className="text-sm font-bold text-slate-500">لا يوجد موردون بعد.</p>}</div></div>
    <div className="rounded-3xl border bg-white p-6 shadow-card"><div className="mb-4 flex items-center gap-2"><ReceiptText className="h-5 w-5 text-amber-600" /><div><h2 className="font-black">استلام مخزون وتكلفة</h2><p className="mt-1 text-xs leading-5 text-slate-500">يزيد المخزون ويسجل آخر تكلفة ومتوسط التكلفة المرجح مع حركة مخزون وسجل تغيير.</p></div></div><form onSubmit={receiveCost} className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-2"><div className="space-y-2 md:col-span-2"><Label>المتغير</Label><select name="variantId" required className="h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="">اختر المتغير</option>{variants.map((variant) => <option key={variant.variantId} value={variant.variantId}>{variant.productName} — {variant.title || "افتراضي"} ({variant.sku}) • مخزون {variant.stockQuantity}</option>)}</select></div><div className="space-y-2"><Label>المورد</Label><select name="supplierId" className="h-11 w-full rounded-xl border bg-white px-3 text-sm"><option value="">بدون مورد</option>{suppliers.filter((supplier) => supplier.status === "active").map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div><Field name="referenceNumber" label="رقم الفاتورة/المرجع" /><Field name="quantity" label="الكمية المستلمة" type="number" required /><Field name="unitCost" label="تكلفة الوحدة" type="number" required /><Field name="batchNumber" label="رقم الدُفعة (اختياري)" /><Field name="expiryDate" label="تاريخ الصلاحية (اختياري)" type="date" /><div className="md:col-span-2"><Button disabled={loading || !variantsById.size}>تسجيل الاستلام والتكلفة</Button></div></form></div>
    <div className="rounded-3xl border bg-white p-6 shadow-card xl:col-span-2"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Boxes className="h-5 w-5 text-violet-600" /><div><h2 className="font-black">الدُفعات وتواريخ الصلاحية</h2><p className="mt-1 text-xs leading-5 text-slate-500">تظهر فقط بعد أن تفعل الإدارة قدرة القطاع المناسبة للمتجر؛ لا تُفرض على متاجر لا تحتاجها.</p></div></div><Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>تحديث</Button></div>{batches.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-right text-sm"><thead className="bg-slate-50"><tr><th className="p-3">المنتج</th><th className="p-3">SKU</th><th className="p-3">الدُفعة</th><th className="p-3">الصلاحية</th><th className="p-3">المتاح</th></tr></thead><tbody>{batches.map(({ batch, productName, variantSku }) => <tr key={batch.id} className="border-t"><td className="p-3 font-bold">{productName}</td><td className="p-3">{variantSku}</td><td className="p-3">{batch.batchNumber}</td><td className="p-3">{batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString("ar") : "—"}</td><td className="p-3">{batch.availableQuantity}</td></tr>)}</tbody></table></div> : <div className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500"><Truck className="ml-2 inline h-4 w-4" /> لا توجد دُفعات مفعلة أو مسجلة حالياً.</div>}</div>
    {message ? <div className="xl:col-span-2 rounded-2xl border bg-white p-4 text-sm font-bold text-slate-700">{message}</div> : null}
  </section>;
}

function Field({ name, label, type = "text", required = false }: { name: string; label: string; type?: string; required?: boolean }) { return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} required={required} /></div>; }
