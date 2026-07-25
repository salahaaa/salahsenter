"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { apiClient, ApiClientError } from "@/lib/client/api-client";

type StoreRow = {
  id: string;
  name: string;
  slug: string;
  storeNumber: string;
  status: "active" | "pending" | "suspended" | "closed" | "frozen";
  isActive: boolean;
  orderCount: number;
  profileCompleteness: number;
  ratingAverage: string | number;
  contactPhone: string | null;
  contactEmail: string | null;
  primaryWingId: string | null;
  merchantName: string | null;
  merchantEmail: string | null;
  countryName?: string | null;
  governorateName?: string | null;
  cityName?: string | null;
};

type Wing = { id: string; name: string };
type StoreFilters = { q: string; status: string; wingId: string; page: number };

const statusLabels: Record<StoreRow["status"], string> = {
  active: "نشط",
  pending: "قيد المراجعة",
  suspended: "موقوف",
  closed: "مغلق",
  frozen: "مجمد"
};

export function StoreManagementPanel({ stores, wings, filters, hasNext }: { stores: StoreRow[]; wings: Wing[]; filters: StoreFilters; hasNext: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedStoreId, setExpandedStoreId] = useState<string | null>(null);
  const [incompleteDeletionTarget, setIncompleteDeletionTarget] = useState<StoreRow | null>(null);
  const [incompleteDeletionLoading, setIncompleteDeletionLoading] = useState(false);
  const [incompleteDeletionError, setIncompleteDeletionError] = useState<string | null>(null);

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.status) params.set("status", filters.status);
    if (filters.wingId) params.set("wingId", filters.wingId);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/admin/stores?${query}` : "/admin/stores";
  }

  async function createStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const f = new FormData(formElement);
    const payload = {
      merchantName: f.get("merchantName"),
      merchantEmail: f.get("merchantEmail"),
      merchantPhone: f.get("merchantPhone") || undefined,
      storeName: f.get("storeName"),
      description: f.get("description") || undefined,
      primaryWingId: f.get("primaryWingId") || undefined,
      contactEmail: f.get("contactEmail") || undefined,
      contactPhone: f.get("contactPhone") || undefined,
      status: f.get("status") || "active"
    };
    const response = await fetch("/api/admin/stores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json();
    setMessage(response.ok ? `✓ تم إنشاء المتجر. ${json.data?.temporaryPassword ? `كلمة المرور: ${json.data.temporaryPassword}` : ""}` : json.message || "تعذر إنشاء المتجر");
    if (response.ok) { formElement.reset(); setShowCreate(false); router.refresh(); }
  }

  async function resetCredentials(store: StoreRow) {
    if (!window.confirm("سيتم إصدار كلمة مرور مؤقتة جديدة للتاجر وإرسال إشعار. هل تريد المتابعة؟")) return;
    const response = await fetch(`/api/admin/stores/${store.id}/reset-password`, { method: "POST" });
    const json = await response.json();
    setMessage(response.ok ? `✓ بيانات الدخول الجديدة: رقم المتجر ${json.data.storeNumber} / المستخدم ${json.data.username} / كلمة المرور ${json.data.temporaryPassword}` : json.message || "تعذر إصدار بيانات الدخول");
    if (response.ok) router.refresh();
  }

  async function updateStore(store: StoreRow, patch: Record<string, unknown>) {
    const response = await fetch(`/api/admin/stores/${store.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const json = await response.json();
    setMessage(response.ok ? "✓ تم تحديث المتجر" : json.message || "تعذر تحديث المتجر");
    if (response.ok) router.refresh();
  }

  async function closeStore(store: StoreRow) {
    const reason = window.prompt(`سبب إغلاق/حذف المتجر: ${store.name}`, "متجر غير مكتمل أو مخالف لسياسات المنصة");
    if (reason === null) return;
    if (!window.confirm("سيتم إخفاء المتجر عن المتسوقين وإبلاغ التاجر. هل تريد المتابعة؟")) return;
    const response = await fetch(`/api/admin/stores/${store.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    const json = await response.json().catch(() => ({}));
    setMessage(response.ok ? "✓ تم إغلاق المتجر وإخفاؤه" : json.message || "تعذر إغلاق المتجر");
    if (response.ok) router.refresh();
  }

  async function deleteIncompleteStore(reason: string) {
    const store = incompleteDeletionTarget;
    if (!store) return;
    setIncompleteDeletionLoading(true); setIncompleteDeletionError(null);
    try {
      const data = await apiClient.delete<{ message: string }>(`/api/admin/stores/${store.id}/incomplete`, { reason, confirmationStoreNumber: store.storeNumber }, { invalidateTags: ["admin:stores"] });
      setMessage(`✓ ${data.message}`); setIncompleteDeletionTarget(null); router.refresh();
    } catch (caught) {
      setIncompleteDeletionError(caught instanceof ApiClientError ? caught.message : "تعذر حذف المتجر غير المكتمل");
    } finally { setIncompleteDeletionLoading(false); }
  }

  return (
    <div className="space-y-6">
      {message ? <div className="rounded-2xl border bg-white p-4 text-sm font-bold text-slate-700 shadow-card">{message}</div> : null}

      <section className="rounded-3xl border bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-950">قائمة المتاجر</h2>
            <p className="mt-1 text-xs font-bold leading-6 text-slate-500">تم تحويل العرض إلى جدول سريع بدون شعارات أو أغلفة. افتح التفاصيل فقط عند الحاجة للتعديل.</p>
          </div>
          <Button type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? "إخفاء نموذج الإنشاء" : "إنشاء متجر جديد"}</Button>
        </div>

        <form action="/admin/stores" method="get" className="mb-5 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[1fr_180px_220px_auto_auto]">
          <Input name="q" defaultValue={filters.q} placeholder="بحث باسم المتجر، رقمه، التاجر، البريد أو الهاتف" />
          <select name="status" defaultValue={filters.status} className="h-11 rounded-xl border bg-white px-4 text-sm">
            <option value="">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="pending">قيد المراجعة</option>
            <option value="suspended">موقوف</option>
            <option value="frozen">مجمد</option>
            <option value="closed">مغلق</option>
          </select>
          <select name="wingId" defaultValue={filters.wingId} className="h-11 rounded-xl border bg-white px-4 text-sm">
            <option value="">كل الأجنحة</option>
            {wings.map((wing) => <option key={wing.id} value={wing.id}>{wing.name}</option>)}
          </select>
          <Button>بحث / فلترة</Button>
          <Button asChild variant="outline"><Link href="/admin/stores">تصفير</Link></Button>
        </form>

        {showCreate ? (
          <form onSubmit={createStore} className="mb-6 rounded-3xl border bg-white p-5 shadow-card">
            <h2 className="mb-2 text-lg font-black text-slate-950">إنشاء متجر من لوحة الأدمن</h2>
            <p className="mb-4 text-xs font-bold text-slate-500">تم حذف حقول الشعار والغلاف من شاشة الأدمن لأنها تبطئ الإدارة؛ التاجر يستطيع إدارة صور متجره من لوحة التاجر.</p>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="اسم التاجر" name="merchantName" required />
              <Field label="بريد التاجر" name="merchantEmail" type="email" required />
              <Field label="هاتف التاجر" name="merchantPhone" />
              <Field label="اسم المتجر" name="storeName" required />
              <div className="space-y-2"><Label>الجناح</Label><select name="primaryWingId" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">بدون</option>{wings.map((wing) => <option key={wing.id} value={wing.id}>{wing.name}</option>)}</select></div>
              <div className="space-y-2"><Label>الحالة</Label><select name="status" className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="active">نشط</option><option value="pending">قيد المراجعة</option><option value="suspended">موقوف</option><option value="frozen">مجمد</option></select></div>
              <Field label="بريد التواصل" name="contactEmail" type="email" />
              <Field label="هاتف التواصل" name="contactPhone" />
              <div className="space-y-2 md:col-span-3"><Label>وصف المتجر</Label><Textarea name="description" /></div>
            </div>
            <div className="mt-4"><Button>إنشاء المتجر</Button></div>
          </form>
        ) : null}

        {!stores.length ? (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">لا توجد متاجر مطابقة للفلاتر الحالية.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[1000px] text-right text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-3">المتجر</th>
                  <th className="p-3">التاجر</th>
                  <th className="p-3">الجناح/الموقع</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">الأداء</th>
                  <th className="p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => {
                  const wingName = wings.find((wing) => wing.id === store.primaryWingId)?.name || "بدون جناح";
                  const expanded = expandedStoreId === store.id;
                  return (
                    <StoreTableRows
                      key={store.id}
                      store={store}
                      wingName={wingName}
                      wings={wings}
                      expanded={expanded}
                      onToggle={() => setExpandedStoreId(expanded ? null : store.id)}
                      onUpdate={updateStore}
                      onCloseStore={closeStore}
                      onDeleteIncomplete={(target) => { setIncompleteDeletionError(null); setIncompleteDeletionTarget(target); }}
                      onResetCredentials={resetCredentials}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-slate-500">
          <span>الصفحة {filters.page} — تظهر 50 نتيجة كحد أقصى لتسريع اللوحة.</span>
          <div className="flex gap-2">
            {filters.page > 1 ? <Button asChild variant="outline" size="sm"><Link href={pageHref(filters.page - 1)}>السابق</Link></Button> : null}
            {hasNext ? <Button asChild variant="outline" size="sm"><Link href={pageHref(filters.page + 1)}>التالي</Link></Button> : null}
          </div>
        </div>
      </section>
      <ActionConfirmationDialog open={Boolean(incompleteDeletionTarget)} title="حذف متجر غير مكتمل نهائياً" description={`سيحذف هذا المتجر وجميع إعداداته ومسودات منتجاته المرتبطة. لا يسمح النظام بهذه العملية إلا للمتجر pending الذي لا يملك طلبات أو بيانات مالية أو تكاملات تشغيلية.`} actionLabel="حذف المتجر نهائياً" destructive reasonRequired confirmationText={incompleteDeletionTarget?.storeNumber} auditContext={`store.incomplete_hard_delete:${incompleteDeletionTarget?.id || ""}`} loading={incompleteDeletionLoading} error={incompleteDeletionError} onClose={() => { if (!incompleteDeletionLoading) { setIncompleteDeletionTarget(null); setIncompleteDeletionError(null); } }} onConfirm={({ reason }) => deleteIncompleteStore(reason)} />
    </div>
  );
}

function StoreTableRows({ store, wingName, wings, expanded, onToggle, onUpdate, onCloseStore, onDeleteIncomplete, onResetCredentials }: { store: StoreRow; wingName: string; wings: Wing[]; expanded: boolean; onToggle: () => void; onUpdate: (store: StoreRow, patch: Record<string, unknown>) => void; onCloseStore: (store: StoreRow) => void; onDeleteIncomplete: (store: StoreRow) => void; onResetCredentials: (store: StoreRow) => void }) {
  const publicPath = `/store/${store.slug}`;
  return (
    <>
      <tr className="border-t align-top hover:bg-slate-50">
        <td className="p-3">
          <div className="font-black text-slate-950">{store.name}</div>
          <div className="mt-1 text-xs font-bold text-slate-400">{publicPath}</div>
        </td>
        <td className="p-3">
          <div className="font-bold">{store.merchantName || "-"}</div>
          <div className="mt-1 text-xs text-slate-500">{store.merchantEmail || "-"}</div>
        </td>
        <td className="p-3">
          <div className="font-bold">{wingName}</div>
          <div className="mt-1 text-xs text-slate-500">{[store.countryName, store.governorateName, store.cityName].filter(Boolean).join(" / ") || "-"}</div>
        </td>
        <td className="p-3"><Badge variant={store.status === "active" && store.isActive ? "success" : store.status === "frozen" ? "danger" : "warning"}>{statusLabels[store.status]} / {store.isActive ? "ظاهر" : "مخفي"}</Badge></td>
        <td className="p-3"><span className="font-bold">{formatNumber(store.ratingAverage)} ★</span><span className="mx-2 text-slate-300">|</span><span>{formatNumber(store.orderCount)} طلب</span></td>
        <td className="p-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onToggle}>{expanded ? "إغلاق التفاصيل" : "تفاصيل / تعديل"}</Button>
            <Button asChild size="sm" variant="outline"><Link href={publicPath}>معاينة</Link></Button>
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-t bg-slate-50">
          <td colSpan={6} className="p-4">
            <StoreDetails store={store} wings={wings} onUpdate={onUpdate} onCloseStore={onCloseStore} onDeleteIncomplete={onDeleteIncomplete} onResetCredentials={onResetCredentials} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function StoreDetails({ store, wings, onUpdate, onCloseStore, onDeleteIncomplete, onResetCredentials }: { store: StoreRow; wings: Wing[]; onUpdate: (store: StoreRow, patch: Record<string, unknown>) => void; onCloseStore: (store: StoreRow) => void; onDeleteIncomplete: (store: StoreRow) => void; onResetCredentials: (store: StoreRow) => void }) {
  const [name, setName] = useState(store.name);
  const [status, setStatus] = useState(store.status);
  const [isActive, setIsActive] = useState(store.isActive);
  const [primaryWingId, setPrimaryWingId] = useState(store.primaryWingId || "");
  const [contactPhone, setContactPhone] = useState(store.contactPhone || "");
  const [contactEmail, setContactEmail] = useState(store.contactEmail || "");
  const publicPath = `/store/${store.slug}`;

  async function copyStoreLink() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    await navigator.clipboard.writeText(`${origin}${publicPath}`);
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="mb-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-xs font-bold text-slate-600 md:grid-cols-4">
        <span>رقم داخلي للأدمن: {store.storeNumber}</span>
        <span>الرابط: {publicPath}</span>
        <span>الهاتف: {store.contactPhone || "-"}</span>
        <span>البريد: {store.contactEmail || "-"}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="اسم المتجر" value={name} onChange={setName} />
        <div className="space-y-2"><Label>الجناح</Label><select value={primaryWingId} onChange={(e) => setPrimaryWingId(e.target.value)} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="">بدون</option>{wings.map((wing) => <option key={wing.id} value={wing.id}>{wing.name}</option>)}</select></div>
        <div className="space-y-2"><Label>الحالة</Label><select value={status} onChange={(e) => { const next = e.target.value as StoreRow["status"]; setStatus(next); setIsActive(next === "active"); }} className="h-11 w-full rounded-xl border bg-white px-4 text-sm"><option value="active">نشط</option><option value="pending">قيد المراجعة</option><option value="suspended">موقوف</option><option value="frozen">مجمد</option><option value="closed">مغلق</option></select></div>
        <label className="flex items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> ظاهر للمتسوقين</label>
        <Field label="هاتف التواصل" value={contactPhone} onChange={setContactPhone} />
        <Field label="بريد التواصل" value={contactEmail} onChange={setContactEmail} />
        <div className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-500">{formatNumber(store.ratingAverage)} ★ / {formatNumber(store.orderCount)} طلب</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onUpdate(store, { name, status, isActive, primaryWingId: primaryWingId || null, contactPhone, contactEmail })}>حفظ بيانات المتجر</Button>
        <Button size="sm" variant="outline" onClick={() => onUpdate(store, { status: "active", isActive: true })}>تفعيل</Button>
        <Button size="sm" variant="outline" onClick={() => onUpdate(store, { status: "suspended", isActive: false })}>إيقاف</Button>
        <Button size="sm" variant="destructive" onClick={() => onUpdate(store, { status: "frozen", isActive: false })}>تجميد</Button>
        <Button size="sm" variant="destructive" onClick={() => onCloseStore(store)}>إغلاق المتجر</Button>
        {store.status === "pending" && store.orderCount === 0 ? <Button size="sm" variant="destructive" onClick={() => onDeleteIncomplete(store)}>حذف نهائي لغير المكتمل</Button> : null}
        <Button type="button" size="sm" variant="secondary" onClick={() => onResetCredentials(store)}>إصدار بيانات دخول</Button>
        <Button type="button" size="sm" variant="outline" onClick={copyStoreLink}>نسخ رابط المتجر</Button>
      </div>
    </div>
  );
}

function Field({ label, name, type = "text", required = false, value, onChange }: { label: string; name?: string; type?: string; required?: boolean; value?: string; onChange?: (value: string) => void }) {
  return <div className="space-y-2"><Label>{label}</Label><Input name={name} type={type} required={required} value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} /></div>;
}
