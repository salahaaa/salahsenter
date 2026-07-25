/**
 * Media Service
 * =============
 * Thin orchestration over the media layer: upload + the base64-rejection guard
 * applied to image fields before persistence. Keeps route handlers free of
 * storage concerns.
 */

import { uploadMediaFile, rejectInlineBase64, type UploadedMedia } from "@/lib/media";

export async function upload(file: File, folder: string): Promise<UploadedMedia> {
  return uploadMediaFile(file, folder);
}

/**
 * Sanitize an image URL field about to be persisted. Returns null when empty,
 * passes through valid URLs, and THROWS when a raw base64 data URL is supplied
 * — preventing new base64 from ever reaching the database.
 */
export function sanitizeImageUrl(value: unknown, field: string): string | null {
  return rejectInlineBase64(value, field);
}

/** Sanitize an array of image URLs (galleries). */
export function sanitizeImageArray(values: unknown, field: string): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((v) => rejectInlineBase64(v, field)).filter((v): v is string => Boolean(v));
}
