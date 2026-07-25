"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { apiClient, ApiClientError } from "@/lib/client/api-client";

export function IssueAdInvoicesButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function issue(reason: string) {
    setLoading(true); setError(null);
    try {
      await apiClient.post("/api/admin/ads/invoices", { note: reason }, { invalidateTags: ["admin:ads", "ads:billing"] });
      setOpen(false); router.refresh();
    } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : "تعذر إصدار الفواتير"); }
    finally { setLoading(false); }
  }
  return <><Button onClick={() => setOpen(true)}>إصدار فواتير اليوم السابق</Button><ActionConfirmationDialog open={open} title="إصدار فواتير الإعلانات" description="سيجري النظام مراجعة قيود CPC/CPM المستحقة لليوم السابق فقط. العملية idempotent ولن تكرر فاتورة موجودة، لكنها تنشئ التزاماً تشغيلياً يجب مراجعته قبل تسويته." actionLabel="إصدار الفواتير" reasonRequired auditContext="ad_invoice_issue_run" loading={loading} error={error} onClose={() => { if (!loading) { setOpen(false); setError(null); } }} onConfirm={({ reason }) => issue(reason)} /></>;
}
