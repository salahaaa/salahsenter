"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { apiClient, ApiClientError } from "@/lib/client/api-client";

export function RequeueDeadLetterButton({ jobId }: { jobId: string }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  async function requeue(reason: string) { setLoading(true); setError(null); try { await apiClient.post(`/api/admin/observability/queue/${jobId}/requeue`, { reason }, { invalidateTags: ["observability:queue"] }); setOpen(false); router.refresh(); } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : "تعذر إعادة الوظيفة"); } finally { setLoading(false); } }
  return <><Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => setOpen(true)}>{loading ? "جارٍ الإعادة..." : "إعادة للطابور"}</Button><ActionConfirmationDialog open={open} title="إعادة وظيفة من DLQ" description="لا تعيد الوظيفة إلا بعد معالجة سبب الفشل؛ ستسجل العملية في Audit Log." actionLabel="إعادة للطابور" reasonRequired auditContext={`dead_letter_requeue:${jobId}`} loading={loading} error={error} onClose={() => { if (!loading) { setOpen(false); setError(null); } }} onConfirm={({ reason }) => requeue(reason)} /></>;
}
