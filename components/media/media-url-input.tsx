"use client";

import { useEffect, useState, type ChangeEvent, type SyntheticEvent } from "react";
import { CheckCircle2, ImageIcon, Loader2, UploadCloud, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { assessImageDimensions, type ImageQualityAssessment, type ImageQualityProfile } from "@/lib/media/image-quality";

type UploadState = "idle" | "uploading" | "success" | "error";

export function MediaUrlInput({
  label,
  name,
  storeId,
  folder,
  placeholder = "ضع رابط الصورة أو ارفع ملفاً",
  defaultValue = "",
  value,
  onValueChange,
  accept = "image/*,video/*,application/pdf",
  required = false,
  imageQualityProfile = "general"
}: {
  label: string;
  name: string;
  storeId?: string;
  folder?: string;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  accept?: string;
  required?: boolean;
  /** Enforces an upload quality gate; product images require at least 640×640. */
  imageQualityProfile?: ImageQualityProfile;
}) {
  const [internalUrl, setInternalUrl] = useState(defaultValue || "");
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [quality, setQuality] = useState<ImageQualityAssessment | null>(null);
  const url = value ?? internalUrl;
  const isImage = Boolean(url && (url.startsWith("data:image/") || url.startsWith("/") || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)));

  useEffect(() => {
    if (value === undefined) setInternalUrl(defaultValue || "");
  }, [defaultValue, value]);

  function updateUrl(next: string) {
    if (value === undefined) setInternalUrl(next);
    onValueChange?.(next);
    if (next) {
      setState("success");
      setMessage("✓ تم إدراج الصورة/الرابط. لا تنس حفظ النموذج.");
    } else {
      setQuality(null);
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setState("uploading");
    setMessage("جارٍ رفع الصورة... الرجاء الانتظار");
    const form = new FormData();
    form.append("file", file);
    if (storeId) form.append("storeId", storeId);
    if (folder) form.append("folder", folder);
    if (file.type.startsWith("image/")) form.append("imageQualityProfile", imageQualityProfile);
    try {
      const response = await fetch("/api/media/upload", { method: "POST", body: form });
      const json = await response.json();
      if (!response.ok) {
        setState("error");
        setMessage(json.message || "تعذر الرفع");
        return;
      }
      const assessment = json.data?.asset?.metadata?.imageQuality as ImageQualityAssessment | undefined;
      setQuality(assessment || null);
      updateUrl(json.data.asset.url);
      setState("success");
      const dimensions = assessment?.width && assessment?.height ? ` (${assessment.width}×${assessment.height}px)` : "";
      setMessage(`✓ تم رفع ${file.name}${dimensions} وإدراج الرابط. اضغط حفظ لتثبيت التغيير.`);
    } catch {
      setState("error");
      setMessage("تعذر الاتصال بخدمة الرفع");
    }
  }

  function inspectLoadedImage(event: SyntheticEvent<HTMLImageElement>) {
    // Useful for externally supplied URLs too. Uploads additionally receive a
    // server-side binary inspection, so this client hint is never the only gate.
    const image = event.currentTarget;
    setQuality(assessImageDimensions({ width: image.naturalWidth, height: image.naturalHeight, format: "unknown" }, imageQualityProfile));
  }

  return (
    <div className="space-y-2">
      {label ? <Label htmlFor={name}>{label}</Label> : null}
      <div className="flex gap-2">
        <Input id={name} name={name} value={url} onChange={(event) => updateUrl(event.target.value)} placeholder={placeholder} required={required} />
        <Button type="button" variant={state === "success" ? "secondary" : state === "error" ? "destructive" : "outline"} className="relative shrink-0 overflow-hidden" disabled={state === "uploading"}>
          {state === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "success" ? <CheckCircle2 className="h-4 w-4" /> : state === "error" ? <XCircle className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
          {state === "uploading" ? "يرفع..." : "رفع"}
          <input type="file" accept={accept} onChange={upload} className="absolute inset-0 cursor-pointer opacity-0" disabled={state === "uploading"} />
        </Button>
      </div>
      {isImage ? (
        <div className="overflow-hidden rounded-2xl border bg-slate-50 p-2">
          <img src={url} alt="معاينة الصورة المرفوعة" onLoad={inspectLoadedImage} className="h-44 w-full rounded-xl object-contain bg-white p-2" />
        </div>
      ) : url ? (
        <div className="flex items-center gap-2 overflow-hidden rounded-xl border bg-slate-50 p-2 text-xs font-bold text-slate-500"><ImageIcon className="h-4 w-4" /> <span className="truncate">{url}</span></div>
      ) : null}
      {quality ? <ImageQualityHint assessment={quality} /> : null}
      {message ? <p className={`text-xs font-bold ${state === "error" ? "text-red-600" : state === "success" ? "text-emerald-700" : "text-slate-500"}`}>{message}</p> : null}
    </div>
  );
}

function ImageQualityHint({ assessment }: { assessment: ImageQualityAssessment }) {
  const labels = { excellent: "ممتازة", good: "جيدة", needs_attention: "تحتاج مراجعة", rejected: "غير مقبولة", unknown: "غير مؤكدة" };
  const tone = assessment.score === "excellent" || assessment.score === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : assessment.score === "rejected" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800";
  const dimensions = assessment.width && assessment.height ? `${assessment.width}×${assessment.height}px` : "أبعاد غير معروفة";
  return <div className={`rounded-xl border p-3 text-xs font-bold ${tone}`}><div className="flex flex-wrap items-center justify-between gap-2"><span>جودة الصورة: {labels[assessment.score]}</span><span>{dimensions}{assessment.megapixels ? ` • ${assessment.megapixels}MP` : ""}</span></div>{assessment.messages.map((item) => <p key={item} className="mt-1 leading-5">{item}</p>)}{assessment.recommendations[0] ? <p className="mt-1 leading-5 opacity-85">اقتراح: {assessment.recommendations[0]}</p> : null}</div>;
}
