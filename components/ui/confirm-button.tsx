"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";

/** Legacy-compatible confirmation button backed by the shared accessible dialog. */
export function ConfirmButton({ message, onConfirm, children, destructive, auditContext, ...props }: ButtonProps & { message: string; onConfirm: () => void | Promise<void>; destructive?: boolean; auditContext?: string }) {
  const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  async function confirm() { setLoading(true); setError(null); try { await onConfirm(); setOpen(false); } catch (caught) { setError(caught instanceof Error ? caught.message : "تعذر تنفيذ العملية"); } finally { setLoading(false); } }
  return <><Button {...props} onClick={() => setOpen(true)}>{children}</Button><ActionConfirmationDialog open={open} title="تأكيد الإجراء" description={message} actionLabel="تأكيد" destructive={destructive} auditContext={auditContext} loading={loading} error={error} onClose={() => { if (!loading) { setOpen(false); setError(null); } }} onConfirm={confirm} /></>;
}
