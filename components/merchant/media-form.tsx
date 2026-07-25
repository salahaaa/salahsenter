"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { MediaUrlInput } from "@/components/media/media-url-input";
import { MediaGalleryInput } from "@/components/media/media-gallery-input";

export function MediaForm({ storeId }: { storeId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    setLoading(true);
    setMessage(null);
    const gallery = String(formData.get("gallery") || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const response = await fetch("/api/merchant/store-media", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        coverImageUrl: formData.get("coverImageUrl") || "",
        logoUrl: formData.get("logoUrl") || "",
        introImageUrl: formData.get("introImageUrl") || "",
        videoUrl: formData.get("videoUrl") || "",
        gallery
      })
    });
    const json = await response.json();
    setLoading(false);
    setMessage(response.ok ? "✓ تم تحديث وسائط المتجر بنجاح" : json.message || "تعذر تحديث الوسائط");
  }

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-3xl border bg-white p-6 shadow-card md:grid-cols-2">
      <MediaUrlInput label="صورة الغلاف الرئيسية" name="coverImageUrl" storeId={storeId} folder={`stores/${storeId}/cover`} />
      <MediaUrlInput label="شعار المتجر" name="logoUrl" storeId={storeId} folder={`stores/${storeId}/logo`} />
      <MediaUrlInput label="صورة تعريفية" name="introImageUrl" storeId={storeId} folder={`stores/${storeId}/intro`} />
      <MediaUrlInput label="فيديو تعريفي" name="videoUrl" storeId={storeId} folder={`stores/${storeId}/video`} />
      <div className="md:col-span-2"><MediaGalleryInput label="معرض الصور — روابط أو رفع حتى 20 صورة" name="gallery" storeId={storeId} folder={`stores/${storeId}/gallery`} accept="image/*" /></div>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button disabled={loading}>{loading ? "جارٍ الحفظ..." : "حفظ الوسائط"}</Button>
        {message ? <span className="text-sm font-bold text-slate-600">{message}</span> : null}
      </div>
    </form>
  );
}
