"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionConfirmationDialog } from "@/components/ui/action-confirmation-dialog";
import { apiClient, ApiClientError } from "@/lib/client/api-client";

export function RevokeUserSessionsButton({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function revoke(reason: string) { setLoading(true); setMessage(null); try { const data = await apiClient.post<{ revokedSessions: number }>(`/api/admin/users/${userId}/sessions`, { reason }, { invalidateTags: ["admin:users"] }); setMessage(`تم إلغاء ${data.revokedSessions ?? 0} جلسة`); setOpen(false); router.refresh(); } catch (caught) { setMessage(caught instanceof ApiClientError ? caught.message : "تعذر إلغاء الجلسات"); } finally { setLoading(false); } }
  return <div className="flex flex-col items-end gap-1"><Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => setOpen(true)}>{loading ? "جارٍ الإلغاء..." : "إلغاء الجلسات"}</Button>{message ? <span className="text-[11px] font-bold text-slate-500">{message}</span> : null}<ActionConfirmationDialog open={open} title="إلغاء جلسات المستخدم" description={`سيخرج المستخدم «${userName}» من كل الأجهزة ويحتاج تسجيل الدخول مجدداً.`} actionLabel="إلغاء كل الجلسات" destructive reasonRequired auditContext={`revoke_sessions:${userId}`} loading={loading} error={message?.startsWith("تم ") ? null : message} onClose={() => { if (!loading) setOpen(false); }} onConfirm={({ reason }) => revoke(reason)} /></div>;
}
