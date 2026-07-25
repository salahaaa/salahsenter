/**
 * Media Layer — public facade
 * ===========================
 * The single entry point for uploads (`import { uploadMediaFile } from "@/lib/media"`).
 *
 * Responsibilities:
 *   1. Run provider-independent validation (guards).
 *   2. Resolve the configured provider (local | cloudinary | s3 | r2).
 *   3. ENFORCE the "no new base64" rule: when inline fallback would be selected
 *      but the file is too large, refuse rather than bloating the database.
 *
 * Provider swap is a pure config change (MEDIA_PROVIDER env). To add a new
 * provider, implement `MediaProvider` and register it in `resolveProvider()`.
 */

import type { MediaProvider, MediaProviderName, UploadedMedia } from "./types";
import { INLINE_MAX_BYTES } from "./types";
import {
  assertFileSignature,
  assertNoExecutableSignature,
  runMalwareScanHook,
  sanitizeFolder,
  validateFileNameAndMime
} from "./guards";
import { localProvider } from "./providers/local";
import { cloudinaryProvider } from "./providers/cloudinary";
import { createS3Provider } from "./providers/s3";
import { inlineProvider } from "./providers/inline";
import { assertImageQuality, type ImageQualityProfile } from "./image-quality";
import { isStrictProductionLaunch } from "@/lib/production/launch-mode";

export type { UploadedMedia, MediaProvider, MediaProviderName } from "./types";
export { assessImageDimensions, inspectImageQuality, readImageDimensions, type ImageQualityAssessment, type ImageQualityProfile } from "./image-quality";

function isServerlessLocalUpload(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY) && (process.env.MEDIA_PROVIDER || "local") === "local";
}

function assertProductionMediaProvider(name: MediaProviderName) {
  if (isStrictProductionLaunch() && ["local", "inline"].includes(name)) {
    throw new Error("Production launch mode requires MEDIA_PROVIDER=cloudinary, s3, or r2. Local/inline media storage is disabled.");
  }
}

/** Resolve the active provider from configuration. */
export function resolveProvider(): { provider: MediaProvider; name: MediaProviderName } {
  const name = (process.env.MEDIA_PROVIDER || "local") as MediaProviderName;
  switch (name) {
    case "cloudinary":
      return { provider: cloudinaryProvider, name };
    case "s3":
      return { provider: createS3Provider("s3"), name };
    case "r2":
      return { provider: createS3Provider("r2"), name };
    case "inline":
      assertProductionMediaProvider("inline");
      return { provider: inlineProvider, name };
    case "local":
    default:
      // On serverless runtimes without object storage, fall back to inline
      // (base64) ONLY for small images; large ones are rejected upstream.
      if (isServerlessLocalUpload()) {
        assertProductionMediaProvider("inline");
        return { provider: inlineProvider, name: "inline" };
      }
      assertProductionMediaProvider("local");
      return { provider: localProvider, name: "local" };
  }
}

/**
 * Upload a media file through the active provider with full validation.
 * This is the drop-in replacement for the legacy `uploadMediaFile`.
 */
export async function uploadMediaFile(file: File, folder = "general", options: { imageQualityProfile?: ImageQualityProfile } = {}): Promise<UploadedMedia> {
  const maxSizeMb = Number(process.env.MEDIA_MAX_SIZE_MB || 8);
  if (file.size <= 0) throw new Error("الملف فارغ أو غير صالح");
  if (file.size > maxSizeMb * 1024 * 1024) throw new Error(`حجم الملف يتجاوز الحد المسموح (${maxSizeMb}MB)`);

  validateFileNameAndMime(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  assertNoExecutableSignature(buffer);
  assertFileSignature(file, buffer);
  await runMalwareScanHook(file, buffer);

  // Product/category/banner files receive a measured quality assessment before
  // storage. A product image below the minimum is rejected instead of being
  // allowed to degrade the storefront later.
  const imageQuality = file.type.startsWith("image/")
    ? assertImageQuality(buffer, options.imageQualityProfile || "general")
    : null;

  const safeFolder = sanitizeFolder(folder);
  const { provider, name } = resolveProvider();

  // ── Enforcement: no new base64 images in the database ────────────────
  // The inline provider writes a data: URL straight into a DB column. We only
  // permit it for small images; anything larger MUST go to object storage.
  if (name === "inline" && buffer.length > INLINE_MAX_BYTES) {
    throw new Error(
      `حجم الصورة (${(buffer.length / 1024 / 1024).toFixed(1)}MB) يتجاوز الحد للرفع الداخلي. ` +
        "اضبط MEDIA_PROVIDER=cloudinary أو s3/r2 للصور الكبيرة."
    );
  }

  const uploaded = await provider.upload({ buffer, fileName: file.name, mimeType: file.type, sizeBytes: file.size, folder: safeFolder });
  return {
    ...uploaded,
    metadata: {
      ...(uploaded.metadata || {}),
      ...(imageQuality ? { imageQuality } : {})
    }
  };
}

/**
 * Guard for any persistence path that stores image URLs. Rejects raw base64
 * data URLs so new writes (products, stores, wings, banners…) can never bloat
 * the database again. Call this before any INSERT/UPDATE of an image field.
 */
export function rejectInlineBase64(value: unknown, field: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value)) {
    throw new Error(
      `لا يمكن حفظ صورة base64 في الحقل "${field}". ارفع الصورة عبر واجهة الرفع لتُخزَّن في CDN/S3.`
    );
  }
  return value;
}

/** True when the configured media backend is an object-storage provider. */
export function isObjectStorageConfigured(): boolean {
  return ["cloudinary", "s3", "r2"].includes(process.env.MEDIA_PROVIDER || "local");
}
