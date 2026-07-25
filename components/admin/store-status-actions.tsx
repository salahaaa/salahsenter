"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/permissions/permission-gate";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { apiClient, ApiClientError } from "@/lib/client/api-client";

type PendingAction = { payload: Record<string, unknown>; title: string; description: string; permission: string[]; destructive?: boolean } | null;

export function StoreStatusActions({ id, status, isActive }: { id: string; status: string; isActive: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState<PendingAction>(null);
  async function execute(reason: string) {
    if (!pending) return; setLoading(true); setError(null);
    try {
      await apiClient.patch(`/api/admin/stores/${id}`, { ...pending.payload, auditReason: reason || undefined }, { invalidateTags: ["admin:stores", `store:${id}`] });
      setPending(null); router.refresh();
    } catch (caught) { setError(caught instanceof ApiClientError ? `${caught.message}${caught.requestId ? ` (Request: ${caught.requestId})` : ""}` : "تعذر تحديث المتجر"); }
    finally { setLoading(false); }
  }
  return <div className="flex flex-wrap gap-2">
    <PermissionGate anyOf={["stores.activate", "stores.manage"]}><Button size="sm" variant="outline" disabled={loading || status === "active"} onClick={() => setPending({ payload: { status: "active", isActive: true }, title: "تفعيل المتجر", description: "سيعود المتجر للظهور واستقبال العمليات حسب إعداداته.", permission: ["stores.activate", "stores.manage"] })}>تفعيل</Button></PermissionGate>
    <PermissionGate anyOf={["stores.suspend", "stores.manage"]}><Button size="sm" variant="outline" disabled={loading || status === "suspended"} onClick={() => setPending({ payload: { status: "suspended", isActive: false }, title: "إيقاف المتجر", description: "سيمنع المتجر من استقبال العمليات الجديدة حتى يعاد تفعيله.", permission: ["stores.suspend", "stores.manage"], destructive: true })}>تعطيل</Button></PermissionGate>
    <PermissionGate anyOf={["stores.edit", "stores.manage"]}><Button size="sm" variant="outline" disabled={loading || !isActive} onClick={() => setPending({ payload: { isActive: false }, title: "إخفاء المتجر", description: "سيخفى المتجر من الواجهة العامة مع الاحتفاظ بالبيانات.", permission: ["stores.edit", "stores.manage"] })}>إخفاء</Button></PermissionGate>
    <ActionConfirmationDialog open={Boolean(pending)} title={pending?.title || "تأكيد"} description={pending?.description || ""} actionLabel="تأكيد الإجراء" destructive={pending?.destructive} reasonRequired={Boolean(pending?.destructive)} auditContext={`store:${id} / ${pending?.payload.status || "visibility_change"}`} loading={loading} error={error} onClose={() => { if (!loading) { setPending(null); setError(null); } }} onConfirm={({ reason }) => execute(reason)} />
  </div>;
}
