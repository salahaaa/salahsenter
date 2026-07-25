"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { apiClient, ApiClientError } from "@/lib/client/api-client";

export function ProductModerationActions({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function moderate(reason: string) {
    setLoading(true); setMessage(null);
    try {
      await apiClient.post(`/api/admin/products/${productId}/moderate`, { reason, severity: "high", action: "takedown" }, { invalidateTags: ["admin:products", `product:${productId}`] });
      setOpen(false); router.refresh();
    } catch (caught) { setMessage(caught instanceof ApiClientError ? caught.message : "تعذر تنفيذ الإجراء"); }
    finally { setLoading(false); }
  }
  return <div className="mt-2 space-y-2"><Button type="button" size="sm" variant="destructive" className="w-full" onClick={() => setOpen(true)} disabled={loading}>{loading ? <AlertTriangle className="h-4 w-4 animate-pulse" /> : <Ban className="h-4 w-4" />}حذف/إيقاف مخالف + إنذار</Button><ActionConfirmationDialog open={open} title="إيقاف منتج مخالف" description={`سيوقف المنتج «${productName}» ويرسل إنذاراً يؤثر على جودة المتجر. هذا الإجراء عالي الخطورة.`} actionLabel="إيقاف المنتج وإرسال الإنذار" destructive reasonRequired confirmationText="SUSPEND" auditContext={`product_moderation:${productId} / severity:high`} loading={loading} error={message} onClose={() => { if (!loading) { setOpen(false); setMessage(null); } }} onConfirm={({ reason }) => moderate(reason)} /></div>;
}
