/**
 * Media Layer — validation guards (provider-independent security)
 *
 * Extracted from the legacy monolithic `lib/media.ts` so every provider shares
 * one set of checks: extension allow-list, magic-byte signature verification,
 * executable rejection, and malware-scan hook.
 */

import crypto from "crypto";
import path from "path";

const allowedMimePrefixes = ["image/", "video/"];
const allowedMimeTypes = ["application/pdf"];
const blockedExtensions = new Set([".php", ".phtml", ".phar", ".exe", ".dll", ".msi", ".js", ".mjs", ".cjs", ".bat", ".cmd", ".ps1", ".sh", ".bash", ".zsh", ".fish", ".com", ".scr", ".jar", ".war", ".hta", ".vbs", ".wsf", ".apk", ".deb", ".rpm"]);
const allowedExtensionsByMime: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "video/webm": [".webm"]
};

export function validateFileNameAndMime(file: { name: string; type: string }) {
  const ext = path.extname(file.name).toLowerCase();
  if (!ext || blockedExtensions.has(ext)) throw new Error("امتداد الملف غير مسموح لأسباب أمنية");
  if (!allowedMimePrefixes.some((prefix) => file.type.startsWith(prefix)) && !allowedMimeTypes.includes(file.type)) {
    throw new Error("نوع الملف غير مسموح");
  }
  if (file.type === "image/svg+xml") throw new Error("ملفات SVG غير مسموحة لأسباب أمنية");

  const allowedExtensions = allowedExtensionsByMime[file.type];
  if (allowedExtensions && !allowedExtensions.includes(ext)) throw new Error("امتداد الملف لا يتطابق مع نوعه");
  if (!allowedExtensions && file.type.startsWith("video/") && ![".mp4", ".mov", ".webm"].includes(ext)) throw new Error("امتداد الفيديو غير مسموح");
}

export function sanitizeFolder(folder: string) {
  const clean = folder
    .split("/")
    .map((part) => part.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-"))
    .filter(Boolean)
    .slice(0, 4)
    .join("/");
  return clean || "general";
}

export function safeFileName(fileName: string) {
  const { nanoid } = require("nanoid") as typeof import("nanoid");
  const ext = path.extname(fileName).toLowerCase() || ".bin";
  if (blockedExtensions.has(ext)) throw new Error("امتداد الملف غير مسموح");
  return `${Date.now()}-${nanoid(10)}${ext}`;
}

export function assertNoExecutableSignature(buffer: Buffer) {
  const header = buffer.subarray(0, 8);
  const isWindowsExe = header[0] === 0x4d && header[1] === 0x5a;
  const isElf = header.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
  const isScript = header.toString("utf8").startsWith("#!");
  if (isWindowsExe || isElf || isScript) throw new Error("تم رفض ملف تنفيذي أو سكربت");
}

export function assertFileSignature(file: { type: string }, buffer: Buffer) {
  const header = buffer.subarray(0, 16);
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isPng = header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isGif = header.subarray(0, 6).toString("ascii") === "GIF87a" || header.subarray(0, 6).toString("ascii") === "GIF89a";
  const isWebp = header.subarray(0, 4).toString("ascii") === "RIFF" && header.subarray(8, 12).toString("ascii") === "WEBP";
  const isPdf = header.subarray(0, 4).toString("ascii") === "%PDF";
  const isMp4Like = header.subarray(4, 8).toString("ascii") === "ftyp";

  if (file.type.startsWith("image/") && !(isJpeg || isPng || isGif || isWebp)) throw new Error("توقيع ملف الصورة غير صحيح");
  if (file.type === "application/pdf" && !isPdf) throw new Error("توقيع ملف PDF غير صحيح");
  if (file.type.startsWith("video/") && !isMp4Like) throw new Error("توقيع ملف الفيديو غير صحيح");
}

export async function runMalwareScanHook(file: { name: string; type: string; size: number }, buffer: Buffer) {
  const hookUrl = process.env.MALWARE_SCAN_WEBHOOK_URL;
  if (!hookUrl) return;
  const digest = crypto.createHash("sha256").update(buffer).digest("hex");
  const response = await fetch(hookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: process.env.MALWARE_SCAN_TOKEN ? `Bearer ${process.env.MALWARE_SCAN_TOKEN}` : "" },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size, sha256: digest })
  });
  if (!response.ok) throw new Error("تعذر فحص الملف أمنياً");
  const result = (await response.json().catch(() => ({}))) as { allowed?: boolean; verdict?: string };
  if (result.allowed === false || result.verdict === "malicious") throw new Error("تم رفض الملف بعد فحص الأمان");
}

/** Detects base64 / data-url payloads — used to block new inline image writes. */
export function isDataUrl(value: unknown): boolean {
  return typeof value === "string" && /^data:[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+;base64,/.test(value);
}
