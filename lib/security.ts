import crypto from "crypto";
import { nanoid } from "nanoid";

export function createSecureToken(prefix = "tok") {
  return `${prefix}_${nanoid(32)}`;
}

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function safeCompareHash(raw: string | null | undefined, expectedHash: string | null | undefined) {
  if (!raw || !expectedHash) return false;
  const actual = Buffer.from(sha256(raw));
  const expected = Buffer.from(expectedHash);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
