"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExperiencePreviewScope } from "@/lib/experience-preview";

export function ExperiencePreviewButton({ scope, payload, label = "معاينة قبل النشر", disabled = false }: { scope: ExperiencePreviewScope; payload: unknown; label?: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function preview() { setLoading(true); setMessage(null); try { const response = await fetch("/api/admin/experience-previews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, payload }) }); const json = await response.json().catch(() => ({})); if (!response.ok) throw new Error(json.message || "تعذر إنشاء المعاينة"); window.open(json.data.previewUrl, "_blank", "noopener,noreferrer"); setMessage("تم فتح معاينة خاصة؛ لم يتم النشر."); } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر إنشاء المعاينة"); } finally { setLoading(false); } }
  return <span className="inline-flex items-center gap-2"><Button type="button" variant="outline" disabled={disabled || loading} onClick={preview}>{loading ? "يجهز المعاينة..." : <><Eye className="h-4 w-4"/>{label}</>}</Button>{message ? <span className="text-xs font-bold text-slate-500">{message}</span> : null}</span>;
}
