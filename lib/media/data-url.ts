import { parseInlineDataImage } from "@/lib/inline-media";
import { uploadMediaFile, type UploadedMedia } from "@/lib/media";
import { uploadPrivateDocumentBuffer, type PrivateDocumentUpload } from "@/lib/private-documents-storage";

function extFromMime(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "png";
}

export async function uploadInlineImageDataUrl(input: { dataUrl: string; folder: string; fileNamePrefix: string }): Promise<UploadedMedia> {
  const parsed = parseInlineDataImage(input.dataUrl);
  if (!parsed) throw new Error("صيغة الصورة غير صحيحة");
  const buffer = Buffer.from(parsed.base64, "base64");
  const fileName = `${input.fileNamePrefix}.${extFromMime(parsed.mimeType)}`.replace(/[^a-zA-Z0-9._-]/g, "-");
  const file = new File([buffer], fileName, { type: parsed.mimeType });
  return uploadMediaFile(file, input.folder);
}

/** Legal signatures use the private R2 document bucket, never public media storage. */
export async function uploadPrivateInlineImageDataUrl(input: { dataUrl: string; folder: string; fileNamePrefix: string }): Promise<PrivateDocumentUpload> {
  const parsed = parseInlineDataImage(input.dataUrl);
  if (!parsed) throw new Error("صيغة الصورة غير صحيحة");
  const buffer = Buffer.from(parsed.base64, "base64");
  const fileName = `${input.fileNamePrefix}.${extFromMime(parsed.mimeType)}`.replace(/[^a-zA-Z0-9._-]/g, "-");
  return uploadPrivateDocumentBuffer({ buffer, fileName, mimeType: parsed.mimeType, folder: input.folder });
}
