"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PermissionGate } from "@/components/permissions/permission-gate";
import { apiClient, ApiClientError } from "@/lib/client/api-client";

type Props = {
  id: string;
  status: string;
  type?: string;
  publishedBannerId?: string | null;
};

export function AdCampaignAdminActions({ id, status, type, publishedBannerId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [review, setReview] = useState<any | null>(null);
  const isHomepageBanner = type === "homepage_banner";

  async function update(nextStatus: "approved" | "active" | "paused" | "ended" | "rejected", publishToHomepageBanner = false) {
    const adminNote = nextStatus === "rejected" ? window.prompt("سبب الرفض الذي سيظهر للتاجر:") || "" : undefined;
    if (nextStatus === "rejected" && !adminNote?.trim()) return;
    setLoading(`${nextStatus}:${publishToHomepageBanner ? "publish" : "status"}`);
    setMessage(null);
    try {
      const data = await apiClient.patch<{ message?: string }>("/api/admin/ad-campaigns", { id, status: nextStatus, adminNote, publishToHomepageBanner }, { invalidateTags: ["admin:ads", `ad:${id}`] });
      setMessage(data.message || "تم تحديث الإعلان");
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof ApiClientError ? caught.message : "تعذر تحديث الإعلان");
    } finally { setLoading(null); }
  }

  async function aiReview() {
    setLoading("ai-review");
    setMessage(null);
    try {
      const data = await apiClient.get<{ review: any }>(`/api/admin/ad-campaigns/${id}/ai-review`, { cachePolicy: "no-store" });
      setReview(data.review || null);
    } catch (caught) {
      setMessage(caught instanceof ApiClientError ? caught.message : "تعذر تحليل الإعلان");
    } finally { setLoading(null); }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={status === "active" || status === "approved" ? "success" : status === "rejected" ? "danger" : "warning"}>{status}</Badge>
        {publishedBannerId ? <Badge className="bg-blue-50 text-blue-700">منشور في البنر</Badge> : null}
        {isHomepageBanner ? <Badge className="bg-amber-50 text-amber-700">بنر رئيسية</Badge> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <PermissionGate anyOf={["ads.approve", "ads.manage"]}>
          {isHomepageBanner ? <PermissionGate anyOf={["ads.feature", "ads.manage"]}><Button size="sm" disabled={Boolean(loading)} onClick={() => update("approved", true)}>اعتماد للنشر الإعلاني الرئيسي</Button></PermissionGate> : <Button size="sm" disabled={Boolean(loading)} onClick={() => update("approved")}>اعتماد</Button>}
        </PermissionGate>
        <PermissionGate anyOf={["ads.approve", "ads.manage"]}><Button size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => update("active", isHomepageBanner)}>تفعيل</Button></PermissionGate>
        <PermissionGate anyOf={["ads.suspend", "ads.manage"]}><Button size="sm" variant="outline" disabled={Boolean(loading)} onClick={() => update("paused")}>إيقاف مؤقت</Button></PermissionGate>
        <PermissionGate anyOf={["ads.reject", "ads.manage"]}><Button size="sm" variant="destructive" disabled={Boolean(loading)} onClick={() => update("rejected")}>رفض</Button></PermissionGate>
        <PermissionGate anyOf={["ads.edit", "ads.manage"]}><Button size="sm" variant="outline" disabled={Boolean(loading)} onClick={aiReview}>تحليل AI</Button></PermissionGate>
      </div>
      {review ? <div className="rounded-2xl border bg-slate-50 p-3 text-xs font-bold leading-6 text-slate-600"><div className="mb-1 text-slate-950">تقييم الإعلان: {review.score}% — {review.recommendation}</div>{review.warnings?.length ? <div>ملاحظات: {review.warnings.join(" • ")}</div> : <div>لا توجد ملاحظات خطرة.</div>}</div> : null}
      {message ? <p className="text-xs font-bold text-slate-500">{message}</p> : null}
    </div>
  );
}
