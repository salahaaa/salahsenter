/**
 * Media Layer — shared types & contracts
 * ---------------------------------------
 * Provider-agnostic contracts so swapping Cloudinary ↔ S3 ↔ R2 ↔ local is a
 * configuration change, never a code change. Every provider implements
 * `MediaProvider`; the facade in `lib/media/index.ts` picks one at runtime.
 */

export type MediaProviderName = "local" | "cloudinary" | "s3" | "r2" | "inline";

export type UploadedMedia = {
  provider: MediaProviderName;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  storageKey: string;
  metadata?: Record<string, unknown>;
};

/** Result of a media read/delete operation. */
export type MediaRef = { storageKey: string; provider: MediaProviderName };

/** Contract every storage provider must implement. */
export interface MediaProvider {
  readonly name: MediaProviderName;
  /** Upload a validated buffer/file and return a public URL + storage key. */
  upload(input: UploadInput): Promise<UploadedMedia>;
  /** Delete an object by storage key (best-effort; never throws to caller). */
  delete?(storageKey: string): Promise<void>;
}

export type UploadInput = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  folder: string;
};

/**
 * Hard guard: the maximum size a base64/data-url may reach before we refuse to
 * persist it inline. Anything larger MUST go to object storage. This is the
 * enforcement point for "no new base64 images in the database".
 */
export const INLINE_MAX_BYTES = Number(process.env.INLINE_IMAGE_MAX_SIZE_MB || 2) * 1024 * 1024;
