import crypto from "node:crypto";

export type CloudinaryUploadInput = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  folder?: string;
};

export type CloudinaryUploadResult = {
  url: string;
  secureUrl: string;
  publicId: string;
  bytes?: number;
  resourceType?: string;
  raw: Record<string, unknown>;
};

type CloudinaryConfig = {
  cloudName?: string;
  apiKey?: string;
  apiSecret?: string;
};

function parseCloudinaryUrl(): CloudinaryConfig {
  const raw = process.env.CLOUDINARY_URL;
  if (!raw) return {};
  try {
    const url = new URL(raw);
    if (url.protocol !== "cloudinary:") return {};
    return {
      cloudName: url.hostname,
      apiKey: decodeURIComponent(url.username),
      apiSecret: decodeURIComponent(url.password)
    };
  } catch {
    return {};
  }
}

export function getCloudinaryConfig(): Required<CloudinaryConfig> {
  const parsed = parseCloudinaryUrl();
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || parsed.cloudName;
  const apiKey = process.env.CLOUDINARY_API_KEY || parsed.apiKey;
  const apiSecret = process.env.CLOUDINARY_API_SECRET || parsed.apiSecret;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("إعدادات Cloudinary غير مكتملة");
  return { cloudName, apiKey, apiSecret };
}

function sign(params: Record<string, string | number | undefined>, apiSecret: string) {
  const base = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return crypto.createHash("sha1").update(`${base}${apiSecret}`).digest("hex");
}

function cloudinaryFolder(folder = "general") {
  return `${process.env.CLOUDINARY_FOLDER || "marketplace"}/${folder}`.replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");
}

export function optimizeUrl(url: string, options: { quality?: string; format?: string } = {}) {
  if (!url || !/res\.cloudinary\.com\//.test(url)) return url;
  if (/\/upload\/(?:[^/]+,)*f_auto(?:,[^/]*)?\//.test(url) || /\/upload\/(?:[^/]+,)*q_auto(?:,[^/]*)?\//.test(url)) return url;
  const transformation = [options.format || "f_auto", options.quality || "q_auto"].join(",");
  return url.replace("/upload/", `/upload/${transformation}/`);
}

export async function uploadImage(input: CloudinaryUploadInput): Promise<CloudinaryUploadResult> {
  if (!input.mimeType.startsWith("image/")) throw new Error("uploadImage يدعم الصور فقط");
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = cloudinaryFolder(input.folder);
  const signature = sign({ folder, timestamp }, apiSecret);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }), input.fileName);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);
  form.append("folder", folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form });
  const json = (await response.json()) as Record<string, unknown> & { secure_url?: string; public_id?: string; bytes?: number; resource_type?: string; error?: { message?: string } };
  if (!response.ok || !json.secure_url || !json.public_id) throw new Error(json.error?.message || "تعذر رفع الصورة إلى Cloudinary");
  const optimized = optimizeUrl(json.secure_url);
  return { url: optimized, secureUrl: optimized, publicId: json.public_id, bytes: json.bytes, resourceType: json.resource_type, raw: json };
}

export async function deleteImage(publicId: string) {
  if (!publicId) return { deleted: false };
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign({ public_id: publicId, timestamp }, apiSecret);
  const form = new FormData();
  form.append("public_id", publicId);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: "POST", body: form });
  const json = await response.json().catch(() => ({}));
  return { deleted: response.ok, response: json };
}
