"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ConfirmationPayload = { reason: string; confirmation: string };

/** Accessible replacement for native confirm/prompt in sensitive operations. */
export function ActionConfirmationDialog({
  open,
  title,
  description,
  actionLabel = "تأكيد التنفيذ",
  destructive = false,
  reasonLabel = "السبب / الملاحظة",
  reasonRequired = false,
  confirmationText,
  auditContext,
  loading = false,
  error,
  onClose,
  onConfirm
}: {
  open: boolean;
  title: string;
  description: string;
  actionLabel?: string;
  destructive?: boolean;
  reasonLabel?: string;
  reasonRequired?: boolean;
  /** If supplied, the operator must type this exact value before submitting. */
  confirmationText?: string;
  auditContext?: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (payload: ConfirmationPayload) => void | Promise<void>;
}) {
  const titleId = useId(); const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null); const submitRef = useRef<HTMLButtonElement>(null);
  const [reason, setReason] = useState(""); const [confirmation, setConfirmation] = useState("");
  useEffect(() => { if (open) { setReason(""); setConfirmation(""); window.setTimeout(() => submitRef.current?.focus(), 0); } }, [open]);
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) { event.preventDefault(); onClose(); }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), input:not([disabled])')).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; };
  }, [loading, onClose, open]);
  if (!open) return null;
  const confirmationValid = !confirmationText || confirmation.trim() === confirmationText;
  const canSubmit = !loading && (!reasonRequired || reason.trim().length >= 3) && confirmationValid;
  return <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose(); }}><div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="w-full max-w-lg rounded-[2rem] border bg-white p-6 text-right shadow-2xl"><div className="flex items-start justify-between gap-4"><button type="button" aria-label="إغلاق نافذة التأكيد" disabled={loading} onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"><X className="h-5 w-5" /></button><div className="min-w-0 flex-1"><div className={`mb-3 inline-grid h-11 w-11 place-items-center rounded-2xl ${destructive ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}><AlertTriangle className="h-5 w-5" /></div><h2 id={titleId} className="text-xl font-black text-slate-950">{title}</h2><p id={descriptionId} className="mt-2 text-sm leading-7 text-slate-600">{description}</p></div></div>{auditContext ? <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs font-bold text-blue-800">سيسجل في Audit Log: {auditContext}</p> : null}<div className="mt-5 space-y-4"><label className="block text-sm font-black text-slate-700">{reasonLabel}{reasonRequired ? <span className="text-red-600"> *</span> : <span className="text-slate-400"> (اختياري)</span>}<Textarea value={reason} onChange={(event) => setReason(event.target.value)} disabled={loading} className="mt-2 min-h-24 bg-white" placeholder="اكتب سبباً واضحاً يظهر في سجل التدقيق عند الحاجة" /></label>{confirmationText ? <label className="block text-sm font-black text-slate-700">اكتب <bdi className="rounded bg-slate-100 px-1 text-slate-950">{confirmationText}</bdi> للتأكيد<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={loading} className="mt-2 h-11 w-full rounded-xl border bg-white px-3 text-left font-mono text-sm" dir="ltr" /></label> : null}{error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}</div><div className="mt-6 flex flex-wrap gap-3"><Button ref={submitRef} type="button" variant={destructive ? "destructive" : "default"} disabled={!canSubmit} onClick={() => void onConfirm({ reason: reason.trim(), confirmation: confirmation.trim() })}>{loading ? "جارٍ التنفيذ..." : actionLabel}</Button><Button type="button" variant="outline" disabled={loading} onClick={onClose}>إلغاء</Button></div></div></div>;
}
