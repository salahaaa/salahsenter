import { describe, expect, it } from "vitest";
import { getPublicTables } from "@/lib/backup";
import {
  assertDistinctRecoveryTarget,
  assertStagingRecoveryDrillEnvironment,
  databaseFingerprint,
  normalizedDatabaseIdentity
} from "@/lib/backup/recovery-target";

describe("isolated recovery drill safety", () => {
  it("normalizes source identities without including credentials and rejects a same-database restore target", () => {
    const source = "postgresql://user:secret@db.example.test:5432/staging?sslmode=require";
    expect(normalizedDatabaseIdentity(source)).toBe("db.example.test:5432/staging");
    expect(databaseFingerprint(source)).toHaveLength(64);
    expect(() => assertDistinctRecoveryTarget({ sourceDatabaseUrl: source, recoveryDatabaseUrl: "postgresql://other:secret@db.example.test/staging" })).toThrow(/يطابق/);
    expect(() => assertDistinctRecoveryTarget({ sourceDatabaseUrl: source, recoveryDatabaseUrl: "postgresql://other:secret@recovery.example.test/staging-recovery" })).not.toThrow();
  });

  it("requires an explicit Staging-only recovery environment marker", () => {
    expect(() => assertStagingRecoveryDrillEnvironment({ APP_ENV: "staging", RECOVERY_TEST_ENVIRONMENT: "staging" })).not.toThrow();
    expect(() => assertStagingRecoveryDrillEnvironment({ APP_ENV: "production", RECOVERY_TEST_ENVIRONMENT: "staging" })).toThrow(/APP_ENV=staging/);
    expect(() => assertStagingRecoveryDrillEnvironment({ APP_ENV: "staging", RECOVERY_TEST_ENVIRONMENT: "production" })).toThrow(/RECOVERY_TEST_ENVIRONMENT/);
    expect(() => assertStagingRecoveryDrillEnvironment({ APP_ENV: "staging", RECOVERY_TEST_ENVIRONMENT: "staging", VERCEL_ENV: "production" })).toThrow(/Vercel Production/);
  });

  it("excludes recovery target authorization data from backup/restore table discovery", async () => {
    const client = async () => [
      { table_name: "users" },
      { table_name: "backup_recovery_targets" },
      { table_name: "__drizzle_migrations" },
      { table_name: "orders" }
    ];
    const tables = await getPublicTables(client as any);
    expect(tables).toEqual(["users", "orders"]);
  });
});
