import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { db, operationalDrills, client as sourceClient } from "@/lib/db";
import { getPublicTables, listBackups, readBackupWithIntegrity, restoreBackupPayload } from "@/lib/backup";
import {
  assertAuthorizedStagingRecoveryTarget,
  assertDistinctRecoveryTarget,
  assertStagingRecoveryDrillEnvironment,
  recordStagingRecoveryTargetDrill
} from "@/lib/backup/recovery-target";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} مطلوب لاختبار الاستعادة.`);
  return value;
}

async function writeEvidence(evidence: Record<string, unknown>) {
  const output = process.env.RECOVERY_EVIDENCE_OUTPUT?.trim();
  if (!output) return;
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(evidence, null, 2));
}

async function main() {
  assertStagingRecoveryDrillEnvironment();
  const sourceDatabaseUrl = required("DATABASE_URL");
  const recoveryUrl = required("RECOVERY_TEST_DATABASE_URL");
  if (process.env.RECOVERY_TEST_CONFIRM !== "true") {
    throw new Error("عيّن RECOVERY_TEST_CONFIRM=true. هذا الاختبار سيحذف ويستعيد كل جداول قاعدة recovery المعزولة.");
  }
  assertDistinctRecoveryTarget({ sourceDatabaseUrl, recoveryDatabaseUrl: recoveryUrl });

  const startedAt = Date.now();
  const recoveryClient = postgres(recoveryUrl, { max: 1, prepare: false });
  try {
    const target = await assertAuthorizedStagingRecoveryTarget({ client: recoveryClient, recoveryDatabaseUrl: recoveryUrl });
    const fileName = process.env.BACKUP_FILE || (await listBackups())[0];
    if (!fileName) throw new Error("لا توجد نسخة احتياطية متاحة لاختبار الاستعادة.");

    const { backup, integrity } = await readBackupWithIntegrity(fileName);
    if (integrity.provider === "local" || !integrity.metadataVerified) {
      throw new Error("Recovery drill في Staging يتطلب نسخة R2/S3 ببصمة SHA-256 موثقة في التخزين البعيد.");
    }

    const availableTables = await getPublicTables(recoveryClient);
    const missingSchema = Object.keys(backup.tables).filter((table) => !availableTables.includes(table));
    if (missingSchema.length) {
      throw new Error(`قاعدة recovery لا تحتوي schema المطلوب: ${missingSchema.join(", ")}. طبّق npm run db:migrate عليها أولاً.`);
    }

    const result = await restoreBackupPayload(backup, recoveryClient);
    const mismatches: Array<{ table: string; expected: number; actual: number }> = [];
    for (const [table, rows] of Object.entries(backup.tables)) {
      if (!availableTables.includes(table)) continue;
      const quoted = `"${table.replace(/"/g, "")}"`;
      const [countRow] = await recoveryClient.unsafe(`select count(*)::int as count from ${quoted}`);
      const expected = rows.length;
      const actual = Number(countRow?.count || 0);
      if (expected !== actual) mismatches.push({ table, expected, actual });
    }
    if (mismatches.length) throw new Error(`فشل تحقق counts بعد الاستعادة: ${JSON.stringify(mismatches)}`);

    await recordStagingRecoveryTargetDrill({
      client: recoveryClient,
      recoveryDatabaseUrl: recoveryUrl,
      backupFile: fileName,
      backupSha256: integrity.sha256
    });

    const evidence = {
      ok: true,
      kind: "backup_recovery",
      environment: "staging",
      fileName,
      backup: {
        provider: integrity.provider,
        objectKey: integrity.objectKey,
        sha256: integrity.sha256,
        metadataVerified: integrity.metadataVerified,
        bytes: integrity.bytes
      },
      recoveryTarget: { label: target.targetLabel },
      restored: result.restored,
      tables: result.tables,
      verifiedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt
    };

    await writeEvidence(evidence);
    if (process.env.RECOVERY_RECORD_RELEASE_EVIDENCE === "true") {
      await db.insert(operationalDrills).values({
        kind: "backup_recovery",
        environment: "staging",
        status: "passed",
        evidence,
        note: "Automated isolated Staging recovery drill with verified remote backup checksum."
      });
    }
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await recoveryClient.end({ timeout: 5 }).catch(() => undefined);
    await sourceClient.end({ timeout: 5 }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
