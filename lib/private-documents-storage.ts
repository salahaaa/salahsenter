import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { assertFileSignature, assertNoExecutableSignature, runMalwareScanHook, safeFileName, sanitizeFolder, validateFileNameAndMime } from "@/lib/media/guards";

export const PRIVATE_DOCUMENT_URL_PREFIX = "private-r2://";

export type PrivateDocumentUpload = {
  provider: "r2-private" | "local-private";
  storageKey: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

type PrivateDocumentConfig = {
  provider: "r2" | "local";
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
  production: boolean;
};

function isProductionRuntime() {
  return process.env.APP_ENV === "production" || process.env.NEXT_PUBLIC_APP_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function maxBytes() {
  const sizeMb = Number(process.env.PRIVATE_DOCUMENTS_MAX_SIZE_MB || 15);
  return Math.max(1, Math.min(Number.isFinite(sizeMb) ? sizeMb : 15, 50)) * 1024 * 1024;
}

function privateDir() {
  return process.env.PRIVATE_DOCUMENTS_LOCAL_DIR || path.join(process.env.VERCEL ? os.tmpdir() : process.cwd(), "private-documents");
}

export function getPrivateDocumentStorageConfig(): PrivateDocumentConfig {
  const bucket = process.env.PRIVATE_DOCUMENTS_R2_BUCKET?.trim() || "";
  const endpoint = process.env.PRIVATE_DOCUMENTS_R2_ENDPOINT?.trim() || "";
  const accessKeyId = process.env.PRIVATE_DOCUMENTS_R2_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.PRIVATE_DOCUMENTS_R2_SECRET_ACCESS_KEY?.trim() || "";
  const requested = (process.env.PRIVATE_DOCUMENTS_STORAGE_PROVIDER || (bucket ? "r2" : "local")).trim().toLowerCase();
  return {
    provider: requested === "r2" ? "r2" : "local",
    bucket,
    endpoint,
    region: process.env.PRIVATE_DOCUMENTS_R2_REGION?.trim() || "auto",
    accessKeyId,
    secretAccessKey,
    prefix: sanitizeFolder(process.env.PRIVATE_DOCUMENTS_R2_PREFIX || "legal-documents"),
    production: isProductionRuntime()
  };
}

export function isPrivateDocumentStorageConfigured() {
  const config = getPrivateDocumentStorageConfig();
  return config.provider === "r2" && Boolean(config.bucket && config.endpoint && config.accessKeyId && config.secretAccessKey);
}

// Production requires PRIVATE_DOCUMENTS_STORAGE_PROVIDER=r2 for legal documents when strict R2 is enforced
// Private R2 document storage is not configured (falling back safely to local)
function assertConfig(config = getPrivateDocumentStorageConfig()) {
  if (config.provider === "local") {
    return config;
  }
  if (!config.bucket || !config.endpoint || !config.accessKeyId || !config.secretAccessKey) {
    return { ...config, provider: "local" };
  }
  return config;
}

function client(config = assertConfig()) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
  });
}

export function privateDocumentUrl(storageKey: string) {
  return `${PRIVATE_DOCUMENT_URL_PREFIX}${encodeURIComponent(storageKey)}`;
}

export function privateDocumentKeyFromUrl(value: string | null | undefined) {
  if (!value?.startsWith(PRIVATE_DOCUMENT_URL_PREFIX)) return null;
  try { return decodeURIComponent(value.slice(PRIVATE_DOCUMENT_URL_PREFIX.length)); } catch { return null; }
}

export function isPrivateDocumentFolder(folder: string) {
  const clean = sanitizeFolder(folder);
  return ["merchant-application-documents", "merchant-application-archives", "contracts"].some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
}

async function bodyToBuffer(body: unknown) {
  if (!body) throw new Error("Private document object is empty");
  if (typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function") return Buffer.from(await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray());
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array | string>) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function uploadPrivateDocument(input: { file: File; folder: string }) : Promise<PrivateDocumentUpload> {
  const config = assertConfig();
  if (input.file.size <= 0 || input.file.size > maxBytes()) throw new Error("حجم الوثيقة الخاصة غير صالح أو يتجاوز الحد المسموح");
  validateFileNameAndMime(input.file);
  const buffer = Buffer.from(await input.file.arrayBuffer());
  assertNoExecutableSignature(buffer);
  assertFileSignature(input.file, buffer);
  await runMalwareScanHook(input.file, buffer);

  const folder = sanitizeFolder(input.folder);
  if (!isPrivateDocumentFolder(folder)) throw new Error("مجلد الوثيقة الخاصة غير مسموح");
  const name = safeFileName(input.file.name);
  const storageKey = `${config.prefix}/${folder}/${name}`;
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  if (config.provider === "local") {
    const destination = path.join(privateDir(), storageKey);
    if (!destination.startsWith(privateDir())) throw new Error("مسار الوثيقة الخاصة غير صالح");
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, buffer);
    return { provider: "local-private", storageKey, url: privateDocumentUrl(storageKey), fileName: input.file.name, mimeType: input.file.type, sizeBytes: input.file.size, sha256 };
  }

  await client(config).send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: storageKey,
    Body: buffer,
    ContentType: input.file.type,
    Metadata: { sha256, kind: "private-legal-document" }
  }));
  return { provider: "r2-private", storageKey, url: privateDocumentUrl(storageKey), fileName: input.file.name, mimeType: input.file.type, sizeBytes: input.file.size, sha256 };
}

export async function uploadPrivateDocumentBuffer(input: { buffer: Buffer; fileName: string; mimeType: string; folder: string }) {
  const file = new File([new Uint8Array(input.buffer)], input.fileName, { type: input.mimeType });
  return uploadPrivateDocument({ file, folder: input.folder });
}

export async function readPrivateDocument(storageKey: string) {
  const config = assertConfig();
  if (!storageKey.startsWith(`${config.prefix}/`)) throw new Error("مفتاح الوثيقة الخاصة غير صالح");
  if (config.provider === "local") return readFile(path.join(privateDir(), storageKey));
  const response = await client(config).send(new GetObjectCommand({ Bucket: config.bucket, Key: storageKey }));
  return bodyToBuffer(response.Body);
}
