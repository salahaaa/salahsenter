import crypto from "crypto";
import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return new TextEncoder().encode(secret);
}

export function generateTotpSecret(length = 20) {
  return base32Encode(crypto.randomBytes(length));
}

export function buildTotpUrl(input: { secret: string; accountName: string; issuer?: string }) {
  const issuer = encodeURIComponent(input.issuer || "Salah Center");
  const account = encodeURIComponent(input.accountName);
  return `otpauth://totp/${issuer}:${account}?secret=${input.secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export function generateBackupCodes(count = 10) {
  return Array.from({ length: count }, () => crypto.randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-"));
}

export async function hashCodes(codes: string[]) {
  return Promise.all(codes.map((code) => bcrypt.hash(normalizeCode(code), 12)));
}

export async function verifyBackupCode(code: string, hashes: string[]) {
  const normalized = normalizeCode(code);
  for (const hash of hashes) {
    if (await bcrypt.compare(normalized, hash)) return hash;
  }
  return null;
}

export function verifyTotp(token: string, secret: string, window = 1) {
  const clean = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let offset = -window; offset <= window; offset++) {
    if (generateTotp(secret, step + offset) === clean) return true;
  }
  return false;
}

export async function signMfaChallenge(userId: string) {
  return new SignJWT({ userId, purpose: "mfa_challenge" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(jwtSecret());
}

export async function verifyMfaChallenge(token: string) {
  const result = await jwtVerify(token, jwtSecret());
  const payload = result.payload as { userId?: string; purpose?: string };
  if (payload.purpose !== "mfa_challenge" || !payload.userId) throw new Error("تحدي المصادقة الثنائية غير صالح أو منتهي");
  return payload.userId;
}

function generateTotp(secret: string, counter: number) {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

function base32Encode(buffer: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value: string) {
  const clean = value.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let current = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index === -1) throw new Error("TOTP secret is invalid");
    current = (current << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((current >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function normalizeCode(code: string) {
  return code.replace(/[\s-]/g, "").toUpperCase();
}
