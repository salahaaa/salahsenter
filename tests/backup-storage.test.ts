import { afterEach, describe, expect, it } from "vitest";
import { assertDurableBackupStorage, getBackupStorageConfig } from "@/lib/backup-storage";
import { parseBackupPayload } from "@/lib/backup";

const keys = ["BACKUP_STORAGE_PROVIDER", "BACKUP_S3_BUCKET", "BACKUP_S3_ACCESS_KEY_ID", "BACKUP_S3_SECRET_ACCESS_KEY", "APP_ENV", "NEXT_PUBLIC_APP_ENV", "VERCEL_ENV"] as const;
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    const value = previous[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("backup storage safety", () => {
  it("rejects local-only backup storage in production", () => {
    process.env.APP_ENV = "production";
    process.env.BACKUP_STORAGE_PROVIDER = "local";
    expect(() => assertDurableBackupStorage()).toThrow(/s3 أو r2/);
  });

  it("recognizes a configured durable S3 backup target", () => {
    process.env.APP_ENV = "staging";
    process.env.BACKUP_STORAGE_PROVIDER = "s3";
    process.env.BACKUP_S3_BUCKET = "backup-bucket";
    process.env.BACKUP_S3_ACCESS_KEY_ID = "test-access";
    process.env.BACKUP_S3_SECRET_ACCESS_KEY = "test-secret";
    expect(getBackupStorageConfig().provider).toBe("s3");
    expect(assertDurableBackupStorage().bucket).toBe("backup-bucket");
  });

  it("accepts supported legacy and current backup payload versions", () => {
    expect(parseBackupPayload(JSON.stringify({ version: 2, mode: "full_database_json", createdAt: new Date().toISOString(), tables: {} })).version).toBe(2);
    expect(parseBackupPayload(JSON.stringify({ version: 3, mode: "full_database_json", createdAt: new Date().toISOString(), tables: {}, media: { enabled: false, discovered: 0, entries: [] } })).version).toBe(3);
  });
});
