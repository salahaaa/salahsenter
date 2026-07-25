-- A recovery drill may truncate only a deliberately initialized recovery target.
-- This marker table is excluded from backup payloads and restore truncation so it
-- survives the drill and cannot be copied accidentally from a source database.
CREATE TABLE IF NOT EXISTS "backup_recovery_targets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "environment" varchar(40) NOT NULL,
  "target_label" varchar(120) NOT NULL,
  "target_fingerprint" varchar(64) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "initialized_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_drill_at" timestamp with time zone,
  "last_drill_status" varchar(30),
  "last_backup_file" varchar(255),
  "last_backup_sha256" varchar(64),
  "last_verified_at" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "backup_recovery_targets_environment_unique" ON "backup_recovery_targets" ("environment");
CREATE UNIQUE INDEX IF NOT EXISTS "backup_recovery_targets_fingerprint_unique" ON "backup_recovery_targets" ("target_fingerprint");
CREATE INDEX IF NOT EXISTS "backup_recovery_targets_active_idx" ON "backup_recovery_targets" ("environment", "is_active");

-- Rollback after removing recovery-target authorization code:
-- DROP TABLE IF EXISTS "backup_recovery_targets";
