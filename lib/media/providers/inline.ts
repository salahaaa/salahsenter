import { nanoid } from "nanoid";
import type { MediaProvider, UploadInput, UploadedMedia } from "../types";
import { safeFileName } from "../guards";

/** Inline (base64) provider — only used as a serverless fallback and capped hard. */
export const inlineProvider: MediaProvider = {
  name: "inline",
  async upload(input: UploadInput): Promise<UploadedMedia> {
    if (!input.mimeType.startsWith("image/")) {
      throw new Error("الرفع المحلي على Serverless يدعم الصور فقط. للفيديو/PDF استخدم Cloudinary أو S3/R2.");
    }
    const storageKey = `${input.folder}/${safeFileName(input.fileName)}`;
    return {
      provider: "inline",
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      url: `data:${input.mimeType};base64,${input.buffer.toString("base64")}`,
      storageKey,
      metadata: { note: "Inline data URL fallback for serverless local uploads" }
    };
  }
};
