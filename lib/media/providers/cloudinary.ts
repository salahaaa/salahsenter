import type { MediaProvider, UploadInput, UploadedMedia } from "../types";
import { deleteImage, uploadImage } from "@/lib/cloudinary";

/** Cloudinary provider — signed uploads, returns optimized CDN URL. */
export const cloudinaryProvider: MediaProvider = {
  name: "cloudinary",
  async upload(input: UploadInput): Promise<UploadedMedia> {
    const uploaded = await uploadImage({
      buffer: input.buffer,
      fileName: input.fileName,
      mimeType: input.mimeType,
      folder: input.folder
    });

    return {
      provider: "cloudinary",
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      url: uploaded.url,
      storageKey: uploaded.publicId,
      metadata: uploaded.raw
    };
  },
  async delete(storageKey: string) {
    await deleteImage(storageKey);
  }
};
