"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { apiClient, ApiClientError } from "@/lib/client/api-client";

export function DeleteResourceButton({ endpoint, label = "حذف", message = "هل تريد حذف هذا العنصر؟", auditContext }: { endpoint: string; label?: string; message?: string; auditContext?: string }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  async function remove(reason: string) { setLoading(true); setError(null); try { await apiClient.delete(endpoint, undefined, { invalidateTags: ["resource:list"] }); setOpen(false); router.refresh(); } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : "تعذر الحذف"); } finally { setLoading(false); } }
  return <><Button type="button" size="sm" variant="destructive" onClick={() => setOpen(true)} disabled={loading}>{loading ? "..." : label}</Button><ActionConfirmationDialog open={open} title={label} description={message} actionLabel={label} destructive reasonRequired auditContext={auditContext || endpoint} loading={loading} error={error} onClose={() => { if (!loading) { setOpen(false); setError(null); } }} onConfirm={({ reason }) => remove(reason)} /></>;
}
