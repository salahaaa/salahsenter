import crypto from "crypto";
import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type BackupStorageProvider = "local" | "s3" | "r2";

export const backupDir = process.env.BACKUP_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), "salah-center-backups") : path.join(process.cwd(), "backups"));

function isProductionRuntime() {
  return process.env.APP_ENV === "production" || process.env.NEXT_PUBLIC_APP_ENV === "production" || process.env.VERCEL_ENV === "production";
}

function normalizePrefix(value: string | undefined, fallback: string) {
  return (value || fallback).trim().replace(/^\/+|\/+$/g, "") || fallback;
}

export function getBackupStorageConfig() {
  const requested = (process.env.BACKUP_STORAGE_PROVIDER || (process.env.BACKUP_S3_BUCKET ? "s3" : "local")).trim().toLowerCase();
  const provider: BackupStorageProvider = requested === "r2" ? "r2" : requested === "s3" ? "s3" : "local";
  return {
    provider,
    bucket: process.env.BACKUP_S3_BUCKET?.trim() || "",
    endpoint: process.env.BACKUP_S3_ENDPOINT?.trim() || process.env.S3_ENDPOINT?.trim() || "",
    region: process.env.BACKUP_S3_REGION?.trim() || process.env.S3_REGION?.trim() || "auto",
    accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID?.trim() || process.env.S3_ACCESS_KEY_ID?.trim() || "",
    secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY?.trim() || process.env.S3_SECRET_ACCESS_KEY?.trim() || "",
    databasePrefix: normalizePrefix(process.env.BACKUP_S3_PREFIX, "database"),
    mediaPrefix: normalizePrefix(process.env.BACKUP_MEDIA_PREFIX, "media"),
    production: isProductionRuntime()
  };
}

function assertRemoteConfig(config = getBackupStorageConfig()) {
  if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) throw new Error("إعدادات Backup S3/R2 غير مكتملة. اضبط BACKUP_S3_BUCKET ومفاتيح الوصول.");
  return config;
}

function remoteClient(config = assertRemoteConfig()) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    forcePathStyle: Boolean(config.endpoint && config.provider === "s3"),
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
  });
}

export function assertDurableBackupStorage() {
  const config = getBackupStorageConfig();
  if (config.production && config.provider === "local") throw new Error("الإنتاج يتطلب BACKUP_STORAGE_PROVIDER=s3 أو r2؛ التخزين المحلي أو /tmp غير دائم.");
  if (config.provider !== "local") assertRemoteConfig(config);
  return config;
}

function databaseObjectKey(fileName: string, config = getBackupStorageConfig()) {
  return `${config.databasePrefix}/${fileName}`;
}

function validateBackupFileName(fileName: string) {
  if (!/^backup-[\w.-]+\.json$/.test(fileName)) throw new Error("اسم ملف النسخة غير صحيح");
}

async function bodyToBuffer(body: unknown) {
  if (!body) throw new Error("ملف backup فارغ");
  if (typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function") {
    return Buffer.from(await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray());
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array | string>) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function storeBackupDatabase(fileName: string, raw: Buffer) {
  validateBackupFileName(fileName);
  const config = assertDurableBackupStorage();
  const sha256 = crypto.createHash("sha256").update(raw).digest("hex");
  if (config.provider === "local") {
    await mkdir(backupDir, { recursive: true });
    await writeFile(path.join(backupDir, fileName), raw);
    return { provider: "local" as const, objectKey: fileName, sha256, bytes: raw.length };
  }
  const objectKey = databaseObjectKey(fileName, config);
  const encryption = config.provider === "s3" ? { ServerSideEncryption: process.env.BACKUP_S3_KMS_KEY_ID ? "aws:kms" as const : "AES256" as const, SSEKMSKeyId: process.env.BACKUP_S3_KMS_KEY_ID || undefined } : {};
  await remoteClient(config).send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
    Body: raw,
    ContentType: "application/json",
    ...encryption,
    Metadata: { sha256, kind: "database-backup" }
  }));
  return { provider: config.provider, objectKey, sha256, bytes: raw.length };
}

export async function readStoredBackup(fileName: string) {
  validateBackupFileName(fileName);
  const config = getBackupStorageConfig();
  if (config.provider === "local") return readFile(path.join(backupDir, fileName));
  const response = await remoteClient(config).send(new GetObjectCommand({ Bucket: config.bucket, Key: databaseObjectKey(fileName, config) }));
  return bodyToBuffer(response.Body);
}

export async function verifyStoredBackupIntegrity(fileName: string) {
  validateBackupFileName(fileName);
  const config = getBackupStorageConfig();
  const raw = await readStoredBackup(fileName);
  const sha256 = crypto.createHash("sha256").update(raw).digest("hex");
  const objectKey = config.provider === "local" ? fileName : databaseObjectKey(fileName, config);

  if (config.provider === "local") {
    // Local fallback is only for development. It has no durable remote metadata
    // to compare against, so callers can distinguish calculated from verified.
    return { provider: "local" as const, objectKey, sha256, expectedSha256: null, metadataVerified: false, bytes: raw.length, raw };
  }

  const head = await remoteClient(config).send(new HeadObjectCommand({ Bucket: config.bucket, Key: objectKey }));
  const expectedSha256 = head.Metadata?.sha256 || "";
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) throw new Error("ملف النسخة البعيدة لا يحتوي بصمة SHA-256 موثقة.");
  if (expectedSha256.toLowerCase() !== sha256.toLowerCase()) throw new Error("بصمة SHA-256 لملف النسخة لا تطابق metadata في التخزين البعيد.");
  return { provider: config.provider, objectKey, sha256, expectedSha256, metadataVerified: true, bytes: raw.length, raw };
}

export async function listStoredBackupFiles() {
  const config = getBackupStorageConfig();
  if (config.provider === "local") {
    await mkdir(backupDir, { recursive: true });
    return (await readdir(backupDir)).filter((file) => /^backup-[\w.-]+\.json$/.test(file)).sort().reverse();
  }
  const prefix = `${config.databasePrefix}/`;
  const response = await remoteClient(config).send(new ListObjectsV2Command({ Bucket: config.bucket, Prefix: prefix }));
  return (response.Contents || [])
    .map((entry) => entry.Key || "")
    .filter((key) => key.startsWith(prefix) && /^backup-[\w.-]+\.json$/.test(key.slice(prefix.length)))
    .map((key) => key.slice(prefix.length))
    .sort()
    .reverse();
}

export async function storeBackupMediaObject(input: { key: string; body: Buffer; contentType?: string; sourceSha256: string }) {
  const config = assertDurableBackupStorage();
  const safeKey = input.key.replace(/^\/+/, "");
  if (config.provider === "local") {
    const destination = path.join(backupDir, safeKey);
    if (!destination.startsWith(backupDir)) throw new Error("مسار media backup غير صالح");
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, input.body);
    return { provider: "local" as const, objectKey: safeKey, bytes: input.body.length };
  }
  const encryption = config.provider === "s3" ? { ServerSideEncryption: process.env.BACKUP_S3_KMS_KEY_ID ? "aws:kms" as const : "AES256" as const, SSEKMSKeyId: process.env.BACKUP_S3_KMS_KEY_ID || undefined } : {};
  await remoteClient(config).send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: safeKey,
    Body: input.body,
    ContentType: input.contentType || "application/octet-stream",
    ...encryption,
    Metadata: { sourceSha256: input.sourceSha256, kind: "media-backup" }
  }));
  return { provider: config.provider, objectKey: safeKey, bytes: input.body.length };
}
