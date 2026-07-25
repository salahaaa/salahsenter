"use client";

import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ImageQualityAssessment, ImageQualityProfile } from "@/lib/media/image-quality";

export function MediaGalleryInput({
  label,
  name,
  storeId,
  folder,
  defaultValue = "",
  placeholder = "ضع رابطاً في كل سطر أو ارفع صوراً",
  accept = "image/*",
  imageQualityProfile = "general"
}: {
  label: string;
  name: string;
  storeId?: string;
  folder?: string;
  defaultValue?: string;
  placeholder?: string;
  accept?: string;
  imageQualityProfile?: ImageQualityProfile;
}) {
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setLoading(true);
    setMessage(null);
    const uploaded: string[] = [];
    const qualityNotes: string[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      if (storeId) form.append("storeId", storeId);
      if (folder) form.append("folder", folder);
      if (file.type.startsWith("image/")) form.append("imageQualityProfile", imageQualityProfile);
      const response = await fetch("/api/media/upload", { method: "POST", body: form });
      const json = await response.json();
      if (response.ok) {
        uploaded.push(json.data.asset.url);
        const quality = json.data?.asset?.metadata?.imageQuality as ImageQualityAssessment | undefined;
        if (quality?.score === "needs_attention") qualityNotes.push(`${file.name}: ${quality.messages[0] || "تحتاج مراجعة"}`);
      } else setMessage(json.message || "تعذر رفع بعض الملفات");
    }
    setValue((prev) => [prev.trim(), ...uploaded].filter(Boolean).join("\n"));
    setLoading(false);
    if (uploaded.length) setMessage(`✓ تم رفع ${uploaded.length} ملف وإضافة الروابط${qualityNotes.length ? `. تنبيه جودة: ${qualityNotes.join(" | ")}` : ""}`);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} />
      <Button type="button" variant="outline" className="relative overflow-hidden" disabled={loading}>
        {loading ? "جارٍ الرفع..." : "رفع صور وإضافة روابطها"}
        <input type="file" multiple accept={accept} onChange={upload} className="absolute inset-0 cursor-pointer opacity-0" />
      </Button>
      {message ? <p className="text-xs font-bold text-slate-500">{message}</p> : null}
    </div>
  );
}
